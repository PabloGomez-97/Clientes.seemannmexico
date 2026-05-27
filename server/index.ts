// server/index.ts ESTO ES SOLO PARA DESARROLLO LOCAL
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import chatHandler from '../api/chat.ts'; 
import { fetchAllExpiring, filterMaxWindow } from '../api/services/pricingExpiryService.ts';
import {
  buildAirExpiryAlertHTML, buildAirExpiryAlertSubject,
  buildFCLExpiryAlertHTML, buildFCLExpiryAlertSubject,
  buildLCLExpiryAlertHTML, buildLCLExpiryAlertSubject,
  type AlertType as PricingAlertType,
} from '../api/emails/pricingAlertEmailTemplate.ts';
import { buildOversizeEmailHTML, getOversizeEmailSubject, type OversizeEmailData } from '../api/emails/oversizeEmailTemplate.ts';
import { buildOceanOversizeEmailHTML, getOceanOversizeEmailSubject, type OceanOversizeEmailData } from '../api/emails/oversizeEmailTemplateOcean.ts';
import { buildDocumentUploadEmailHTML, getDocumentUploadEmailSubject, type DocumentUploadEmailData } from '../api/emails/documentUploadEmailTemplate.ts';
import { buildNoRateQuoteEmailHTML, getNoRateQuoteEmailSubject, type NoRateQuoteEmailData } from '../api/emails/noRateQuoteEmailTemplate.ts';
import { buildAirQuoteEmailHTML, getAirQuoteEmailSubject, type AirQuoteEmailData } from '../api/emails/airQuoteEmailTemplate.ts';
import { buildFclQuoteEmailHTML, getFclQuoteEmailSubject, type FclQuoteEmailData } from '../api/emails/fclQuoteEmailTemplate.ts';
import { buildLclQuoteEmailHTML, getLclQuoteEmailSubject, type LclQuoteEmailData } from '../api/emails/lclQuoteEmailTemplate.ts';

import { buildSpecialQuoteEmailHTML, getSpecialQuoteEmailSubject, type SpecialQuoteEmailData } from '../api/emails/specialQuoteEmailTemplate.ts';
import { buildR2Key, getPublicUrl, uploadPDF, deletePDF, deleteAllUserPDFs, downloadPDFBuffer } from '../api/services/r2Storage.ts';
import { buildDocR2Key, uploadDocument, downloadDocumentBuffer, deleteDocument } from '../api/services/r2DocumentStorage.ts';

/** =========================
 *  Entorno + JWT
 *  ========================= */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const JWT_SECRET: jwt.Secret = requireEnv('JWT_SECRET');
const TOKEN_TTL: jwt.SignOptions['expiresIn'] =
  (process.env.JWT_TTL as jwt.SignOptions['expiresIn']) ?? '7d';
const MONGODB_URI = requireEnv('MONGODB_URI');

interface AuthPayload extends jwt.JwtPayload {
  sub: string;
  username: string;
}

function signToken(payload: AuthPayload | object): string {
  const opts: jwt.SignOptions = { expiresIn: TOKEN_TTL };
  return jwt.sign(payload as object, JWT_SECRET, opts);
}

function verifyToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded as AuthPayload;
}

const OPERATIONS_FOLLOWER_EMAIL = 'operaciones@seemanngroup.com';
const MAX_VISIBLE_TRACK_FOLLOWERS = 10;
const MAX_SAVED_TRACKING_EMAILS = 20;
const MAX_SAVED_TRACKING_PHONES = 20;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORED_PHONE_REGEX = /^\+[1-9]\d{4,15}$/;

function normalizeTrackingFollowers(rawFollowers: unknown): string[] {
  const uniqueFollowers = new Map<string, string>();
  const inputFollowers = Array.isArray(rawFollowers) ? rawFollowers : [];

  for (const value of inputFollowers) {
    const email = String(value || '').trim();
    if (!email) continue;

    const key = email.toLowerCase();
    if (key === OPERATIONS_FOLLOWER_EMAIL) continue;
    if (!uniqueFollowers.has(key)) {
      uniqueFollowers.set(key, email);
    }
  }

  return [...uniqueFollowers.values(), OPERATIONS_FOLLOWER_EMAIL];
}

function validateTrackingPreferenceEmails(rawEmails: unknown): {
  emails?: string[];
  error?: string;
} {
  if (!Array.isArray(rawEmails)) {
    return { error: 'emails debe ser un array de correos electrónicos' };
  }

  if (rawEmails.length > MAX_SAVED_TRACKING_EMAILS) {
    return {
      error: `Máximo ${MAX_SAVED_TRACKING_EMAILS} correos permitidos por cuenta`,
    };
  }

  const uniqueEmails = new Map<string, string>();

  for (const rawEmail of rawEmails) {
    if (typeof rawEmail !== 'string') {
      return { error: 'Cada correo debe ser un texto válido' };
    }

    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      return { error: 'No se permiten correos vacíos' };
    }

    if (!EMAIL_REGEX.test(email)) {
      return { error: `El correo ${rawEmail} no es válido` };
    }

    if (email === OPERATIONS_FOLLOWER_EMAIL.toLowerCase()) {
      return {
        error:
          'El correo de operaciones se agrega automáticamente y no debe configurarse manualmente',
      };
    }

    if (uniqueEmails.has(email)) {
      return { error: 'No se permiten correos duplicados' };
    }

    uniqueEmails.set(email, email);
  }

  return { emails: Array.from(uniqueEmails.values()) };
}

function normalizeStoredPhone(phone: string): string {
  return phone.trim().replace(/\s/g, '');
}

function validateTrackingPreferencePhones(rawPhones: unknown): {
  phones?: string[];
  error?: string;
} {
  if (!Array.isArray(rawPhones)) {
    return { error: 'phones debe ser un array de teléfonos' };
  }

  if (rawPhones.length > MAX_SAVED_TRACKING_PHONES) {
    return {
      error: `Máximo ${MAX_SAVED_TRACKING_PHONES} teléfonos permitidos por cuenta`,
    };
  }

  const uniquePhones = new Map<string, string>();

  for (const rawPhone of rawPhones) {
    if (typeof rawPhone !== 'string') {
      return { error: 'Cada teléfono debe ser un texto válido' };
    }

    const phone = normalizeStoredPhone(rawPhone);

    if (!phone) {
      return { error: 'No se permiten teléfonos vacíos' };
    }

    if (!STORED_PHONE_REGEX.test(phone)) {
      return { error: `El teléfono ${rawPhone} no es válido` };
    }

    if (uniquePhones.has(phone)) {
      return { error: 'No se permiten teléfonos duplicados' };
    }

    uniquePhones.set(phone, phone);
  }

  return { phones: Array.from(uniquePhones.values()) };
}

async function getShipsgoShipmentFollowerEmail(
  shipmentType: 'air' | 'ocean',
  shipmentId: string,
  followerId: string,
  token: string,
): Promise<string | null> {
  const response = await fetch(
    `https://api.shipsgo.com/v2/${shipmentType}/shipments/${encodeURIComponent(shipmentId)}`,
    {
      method: 'GET',
      headers: {
        'X-Shipsgo-User-Token': token,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => ({}))) as {
    shipment?: { followers?: Array<{ id?: number | string; email?: string }> };
  };

  const follower = data.shipment?.followers?.find(
    (item) => String(item.id) === String(followerId),
  );

  return follower?.email?.trim().toLowerCase() || null;
}

/** =========================
 *  Express app
 *  ========================= */
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.all('/api/chat', (req, res) => chatHandler(req as any, res as any));

/** =========================
 *  Mongoose / Modelos tipados
 *  ========================= */

// ✅ NUEVO: Modelo Ejecutivo
interface IEjecutivo {
  nombre: string;
  email: string;
  telefono: string;
  activo: boolean;
  roles: {
    administrador: boolean;
    pricing: boolean;
    ejecutivo: boolean;
    proveedor: boolean;
    operaciones: boolean;
  };
}

interface IEjecutivoDoc extends IEjecutivo, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type EjecutivoModel = mongoose.Model<IEjecutivoDoc>;

const EjecutivoSchema = new mongoose.Schema<IEjecutivoDoc>(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
    roles: {
      administrador: { type: Boolean, default: false },
      pricing: { type: Boolean, default: false },
      ejecutivo: { type: Boolean, default: true },
      proveedor: { type: Boolean, default: false },
      operaciones: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

const Ejecutivo = (mongoose.models.Ejecutivo || mongoose.model<IEjecutivoDoc>('Ejecutivo', EjecutivoSchema)) as EjecutivoModel;

// ✅ MODIFICADO: Modelo User con referencia a Ejecutivo
interface IUser {
  email: string;
  nombreuser: string;
  username: string;
  usernames: string[];  // Múltiples empresas/cuentas asignadas
  passwordHash: string;
  ejecutivoId?: mongoose.Types.ObjectId;  // Referencia al ejecutivo
  loginFailCount?: number;
  loginCaptchaRequired?: boolean;
}

interface IUserDoc extends IUser, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type UserModel = mongoose.Model<IUserDoc>;

const UserSchema = new mongoose.Schema<IUserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, trim: true },
    usernames: { type: [String], default: [] },  // Múltiples empresas
    nombreuser: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    ejecutivoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejecutivo' },
    loginFailCount: { type: Number, default: 0 },
    loginCaptchaRequired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = (mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema)) as UserModel;

/** =========================
 *  Turnstile verification
 *  ========================= */
async function verifyTurnstile(token: string, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY no configurada');
    return false;
  }
  const params = new URLSearchParams({ secret, response: token });
  if (remoteip) params.set('remoteip', remoteip);
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { success: boolean };
    return data.success === true;
  } catch (e) {
    console.error('[turnstile] error al verificar:', e);
    return false;
  }
}

const normalizeCompanyName = (value: string): string =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const findDuplicateCompanyNames = async (companyNames: string[]): Promise<string[]> => {
  const normalizedRequested = Array.from(
    new Set(companyNames.map((name) => normalizeCompanyName(name)).filter(Boolean))
  );

  if (normalizedRequested.length === 0) {
    return [];
  }

  const existingUsers = await User.find(
    { username: { $ne: 'Ejecutivo' } },
    { username: 1, usernames: 1 }
  ).lean();

  const duplicates = new Set<string>();

  for (const existingUser of existingUsers) {
    const existingCompanies = Array.from(
      new Set([
        existingUser.username,
        ...(Array.isArray(existingUser.usernames) ? existingUser.usernames : []),
      ])
    );

    for (const existingCompany of existingCompanies) {
      const normalizedExisting = normalizeCompanyName(existingCompany);
      if (normalizedRequested.includes(normalizedExisting)) {
        duplicates.add(existingCompany);
      }
    }
  }

  return Array.from(duplicates);
};

interface ITrackingEmailPreference {
  reference: string;
  emails: string[];
  phones: string[];
  updatedBy: string;
}

interface ITrackingEmailPreferenceDoc
  extends ITrackingEmailPreference,
    mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type TrackingEmailPreferenceModel = mongoose.Model<ITrackingEmailPreferenceDoc>;

const TrackingEmailPreferenceSchema = new mongoose.Schema<ITrackingEmailPreferenceDoc>(
  {
    reference: { type: String, required: true, unique: true, trim: true, index: true },
    emails: { type: [String], default: [] },
    phones: { type: [String], default: [] },
    updatedBy: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const TrackingEmailPreference =
  (mongoose.models.TrackingEmailPreference ||
    mongoose.model<ITrackingEmailPreferenceDoc>(
      'TrackingEmailPreference',
      TrackingEmailPreferenceSchema,
    )) as TrackingEmailPreferenceModel;

async function getShipsgoExecutiveProfileForUser(
  email: string,
): Promise<IEjecutivoDoc | null> {
  const lookupEmail = String(email || '').toLowerCase().trim();

  if (!lookupEmail) {
    return null;
  }

  return Ejecutivo.findOne({ email: lookupEmail });
}

async function canManageShipsgoReference(
  currentUser: AuthPayload,
  reference: string,
): Promise<boolean> {
  const normalizedReference = String(reference || '').trim();

  if (!normalizedReference) {
    return false;
  }

  if (normalizedReference === currentUser.username) {
    return true;
  }

  const me = await User.findOne({ email: currentUser.sub });

  if (!me) {
    return false;
  }

  const ownReferences = new Set(
    [me.username, ...(Array.isArray(me.usernames) ? me.usernames : [])]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );

  if (ownReferences.has(normalizedReference)) {
    return true;
  }

  const myExecutiveProfile = await getShipsgoExecutiveProfileForUser(me.email);

  if (!myExecutiveProfile) {
    return false;
  }

  const targetClient = await User.exists({
    username: { $ne: 'Ejecutivo' },
    $or: [{ username: normalizedReference }, { usernames: normalizedReference }],
  });

  return !!targetClient;
}

async function canDeleteShipsgoShipment(
  currentUser: AuthPayload,
  shipmentType: 'air' | 'ocean',
  shipmentId: string,
  token: string,
): Promise<{ allowed: boolean; status: number; error?: string }> {
  const detailResponse = await fetch(
    `https://api.shipsgo.com/v2/${shipmentType}/shipments/${encodeURIComponent(shipmentId)}`,
    {
      method: 'GET',
      headers: {
        'X-Shipsgo-User-Token': token,
      },
    },
  );

  if (detailResponse.status === 404) {
    return {
      allowed: false,
      status: 404,
      error: 'Tracking no encontrado',
    };
  }

  if (!detailResponse.ok) {
    return {
      allowed: false,
      status: detailResponse.status,
      error: 'No se pudo validar el tracking',
    };
  }

  const detailData = (await detailResponse.json().catch(() => ({}))) as {
    shipment?: { reference?: string | null };
  };

  const reference = String(detailData.shipment?.reference || '').trim();

  if (reference) {
    const canManageReference = await canManageShipsgoReference(
      currentUser,
      reference,
    );

    return canManageReference
      ? { allowed: true, status: 200 }
      : {
          allowed: false,
          status: 403,
          error: 'No tienes permisos para eliminar este tracking',
        };
  }

  const me = await User.findOne({ email: currentUser.sub });
  const myExecutiveProfile = me
    ? await getShipsgoExecutiveProfileForUser(me.email)
    : null;

  if (myExecutiveProfile) {
    return { allowed: true, status: 200 };
  }

  return {
    allowed: false,
    status: 403,
    error: 'No tienes permisos para eliminar este tracking',
  };
}

function getRequestedDocumentOwnerUsername(req: express.Request): string | undefined {
  const headerValue = req.headers['x-owner-username'];
  const headerOwner = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const queryOwner = Array.isArray(req.query.ownerUsername)
    ? req.query.ownerUsername[0]
    : req.query.ownerUsername;
  const bodyOwner = req.body?.ownerUsername;

  for (const candidate of [headerOwner, queryOwner, bodyOwner]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

type DocumentExecutiveAccess = {
  _id?: mongoose.Types.ObjectId | null;
  roles?: IEjecutivo['roles'];
} | null;

async function resolveDocumentOwnerUsername(
  currentUser: AuthPayload,
  requestedOwnerUsername?: unknown,
): Promise<string> {
  const me = await User.findOne({ email: currentUser.sub }).populate('ejecutivoId');

  if (!me) {
    throw new Error('Usuario no encontrado');
  }

  const ownUsernames = (Array.isArray(me.usernames) && me.usernames.length > 0
    ? me.usernames
    : [me.username]
  )
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const requested = String(requestedOwnerUsername || '').trim();

  if (!requested) {
    return ownUsernames[0] || me.username;
  }

  if (ownUsernames.includes(requested)) {
    return requested;
  }

  if (me.username !== 'Ejecutivo') {
    throw new Error('No tienes permiso para acceder a esta cuenta');
  }

  let ejecutivoDoc = me.ejecutivoId as unknown as DocumentExecutiveAccess;
  if (!ejecutivoDoc || !ejecutivoDoc._id) {
    const lookupEmail = String(me.email || '').toLowerCase().trim();
    ejecutivoDoc = await Ejecutivo.findOne({ email: lookupEmail });
  }

  const targetClientQuery = {
    username: { $ne: 'Ejecutivo' },
    $or: [{ username: requested }, { usernames: requested }],
  };

  const hasGlobalExecutiveAccess = !!(
    ejecutivoDoc?.roles?.administrador || ejecutivoDoc?.roles?.operaciones
  );

  if (hasGlobalExecutiveAccess) {
    const targetClient = await User.exists(targetClientQuery);
    if (targetClient) {
      return requested;
    }
    throw new Error('Cliente no encontrado');
  }

  const ejecutivoObjectId = ejecutivoDoc?._id ?? null;
  if (!ejecutivoObjectId) {
    throw new Error('No tienes permiso para acceder a esta cuenta');
  }

  const targetClient = await User.exists({
    ...targetClientQuery,
    ejecutivoId: ejecutivoObjectId,
  });

  if (!targetClient) {
    throw new Error('No tienes permiso para acceder a esta cuenta');
  }

  return requested;
}

function buildDocumentOwnerScopeQuery(ownerUsername: string) {
  if (ownerUsername === 'Ejecutivo') {
    return { usuarioId: ownerUsername };
  }

  return {
    $or: [{ usuarioId: ownerUsername }, { usuarioId: 'Ejecutivo' }],
  };
}

function documentBelongsToOwnerScope(
  documento: { usuarioId?: string | null },
  ownerUsername: string,
): boolean {
  if (documento.usuarioId === ownerUsername) {
    return true;
  }

  return ownerUsername !== 'Ejecutivo' && documento.usuarioId === 'Ejecutivo';
}

// ============================================================
// HELPER: NOTIFICACIÓN POR EMAIL AL SUBIR DOCUMENTO
// ============================================================

/**
 * Envía notificación por correo al ejecutivo y a los emails de seguimiento
 * cuando se sube un documento. Se ejecuta en background (fire-and-forget).
 */
async function sendDocumentUploadNotification(opts: {
  uploaderEmail: string;
  ownerUsername: string;
  numero: string;
  tipoOperacion: string;
  tipoDocumento: string;
  nombreArchivo: string;
}): Promise<void> {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.warn('[doc-notification] BREVO_API_KEY not set, skipping email');
      return;
    }

    // 1. Buscar el usuario dueño del documento para obtener su ejecutivo
    const ownerUser = await User.findOne({
      $or: [{ username: opts.ownerUsername }, { usernames: opts.ownerUsername }],
    }).populate('ejecutivoId');

    // 2. Buscar el usuario que subió el documento (puede ser ejecutivo u otro)
    const uploaderUser = await User.findOne({ email: opts.uploaderEmail }).populate('ejecutivoId');

    // 3. Obtener el email del ejecutivo
    let ejecutivoEmail: string | null = null;
    if (ownerUser?.ejecutivoId && typeof (ownerUser.ejecutivoId as any).email === 'string') {
      ejecutivoEmail = (ownerUser.ejecutivoId as any).email;
    } else if (uploaderUser?.ejecutivoId && typeof (uploaderUser.ejecutivoId as any).email === 'string') {
      ejecutivoEmail = (uploaderUser.ejecutivoId as any).email;
    }

    // 4. Verificar que haya ejecutivo
    if (!ejecutivoEmail) {
      console.log('[doc-notification] No ejecutivo found, skipping');
      return;
    }

    // 6. Determinar quién subió: nombre legible
    const subidoPor = uploaderUser?.nombreuser || uploaderUser?.username || opts.uploaderEmail;

    // 7. Construir el email
    const emailData: DocumentUploadEmailData = {
      numero: opts.numero,
      tipoOperacion: opts.tipoOperacion,
      tipoDocumento: opts.tipoDocumento,
      nombreArchivo: opts.nombreArchivo,
      subidoPor,
    };

    const subject = getDocumentUploadEmailSubject(emailData);
    const htmlContent = buildDocumentUploadEmailHTML(emailData);
    const toList = [{ email: ejecutivoEmail }];

    // 8. Enviar vía Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Seemann Cloud · Documentos', email: 'noreply@sphereglobal.io' },
        to: toList,
        subject,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('[doc-notification] Brevo error:', brevoResponse.status, errorText);
    } else {
      console.log(`[doc-notification] Email sent to ${toList.length} recipients for ${opts.tipoOperacion} #${opts.numero}`);
    }
  } catch (err) {
    // No propagar errores — la subida del documento no debe fallar por el email
    console.error('[doc-notification] Error sending notification:', err);
  }
}

// ============================================================
// MODELO DE DOCUMENTOS (AIR SHIPMENTS)
// ============================================================

type TipoDocumentoAirShipment =
  | 'Documento de transporte Internacional (AWB)'
  | 'Facturas asociados al servicio'
  | 'Invoice'
  | 'Packing List'
  | 'Certificado de Origen'
  | 'Póliza de Seguro'
  | 'Declaración de ingreso (DNI)'
  | 'Guía de despacho'
  | 'SDA'
  | 'Papeleta'
  | 'Transporte local'
  | 'Otros Documentos';

const AirShipmentDocumentoSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, required: true, index: true },

    tipo: {
      type: String,
      required: true,
      enum: [
        'Documento de transporte Internacional (AWB)',
        'Facturas asociados al servicio',
        'Invoice',
        'Packing List',
        'Certificado de Origen',
        'Póliza de Seguro',
        'Declaración de ingreso (DNI)',
        'Guía de despacho',
        'SDA',
        'Papeleta',
        'Transporte local',
        'Otros Documentos',
      ],
    },

    nombreArchivo: { type: String, required: true },
    tipoArchivo: { type: String, required: true },
    tamanoBytes: { type: Number, required: true },
    contenidoBase64: { type: String },
    r2Key: { type: String },

    // trazabilidad/seguridad (igual que en quotes)
    subidoPor: { type: String, required: true }, // email o sub
    usuarioId: { type: String, required: true, index: true }, // username/id interno
  },
  { timestamps: true }
);

AirShipmentDocumentoSchema.index({ shipmentId: 1, usuarioId: 1 });

export const AirShipmentDocumento =
  mongoose.models.AirShipmentDocumento ||
  mongoose.model('AirShipmentDocumento', AirShipmentDocumentoSchema);


// ============================================================
// MODELO DE DOCUMENTOS (OCEAN SHIPMENTS)
// ============================================================

type TipoDocumentoOceanShipment =
  | 'Bill of Lading (BL)'
  | 'Facturas asociadas al servicio'
  | 'Endoso'
  | 'Invoice'
  | 'Packing List'
  | 'Certificado de Origen'
  | 'Póliza de Seguro'
  | 'Declaración de ingreso (DIN)'
  | 'Guía de despacho / Delivery Order'
  | 'SDA'
  | 'Papeleta'
  | 'Transporte local'
  | 'Warehouse Receipt'
  | "Mate's Receipt / Received for shipment"
  | 'Otros Documentos';

const OceanShipmentDocumentoSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, required: true, index: true },

    tipo: {
      type: String,
      required: true,
      enum: [
        'Bill of Lading (BL)',
        'Facturas asociadas al servicio',
        'Endoso',
        'Invoice',
        'Packing List',
        'Certificado de Origen',
        'Póliza de Seguro',
        'Declaración de ingreso (DIN)',
        'Guía de despacho / Delivery Order',
        'SDA',
        'Papeleta',
        'Transporte local',
        'Warehouse Receipt',
        "Mate's Receipt / Received for shipment",
        'Otros Documentos',
      ],
    },

    nombreArchivo: { type: String, required: true },
    tipoArchivo: { type: String, required: true },
    tamanoBytes: { type: Number, required: true },
    contenidoBase64: { type: String },
    r2Key: { type: String },
    subidoPor: { type: String, required: true },
    usuarioId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

OceanShipmentDocumentoSchema.index({ shipmentId: 1, usuarioId: 1 });

export const OceanShipmentDocumento =
  mongoose.models.OceanShipmentDocumento ||
  mongoose.model('OceanShipmentDocumento', OceanShipmentDocumentoSchema);

// ============================================================
// MODELO GROUND-SHIPMENT DOCUMENTOS
// ============================================================

const GroundShipmentDocumentoSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, required: true, index: true },

    tipo: {
      type: String,
      required: true,
      enum: [
        'Carta de porte / Guía de remisión / CMR',
        'Prueba de entrega (POD / remito firmado)',
        'Factura comercial (Invoice)',
        'Packing List',
        'Póliza/Certificado de seguro de transporte',
        'Permisos/autorizaciones (sobredimensionada, especiales)',
        'Documentación del vehículo y conductor (licencia, tarjeta)',
        'Documentos aduaneros/transito (T1, TIR, manifiesto)',
        'Documentos ADR / MSDS (mercancías peligrosas)',
        'Orden/confirmación y factura del transportista (freight invoice)',
        'Delivery Order / Warehouse Receipt (si hay almacenaje)',
        'Certificado de Origen',
        'Papeleta',
        'Otros Documentos',
      ],
    },

    nombreArchivo: { type: String, required: true },
    tipoArchivo: { type: String, required: true },
    tamanoBytes: { type: Number, required: true },
    contenidoBase64: { type: String },
    r2Key: { type: String },
    subidoPor: { type: String, required: true },
    usuarioId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

GroundShipmentDocumentoSchema.index({ shipmentId: 1, usuarioId: 1 });

export const GroundShipmentDocumento =
  mongoose.models.GroundShipmentDocumento ||
  mongoose.model('GroundShipmentDocumento', GroundShipmentDocumentoSchema);

// ============================================================
// MODELO DE DOCUMENTOS EN MONGODB
// ============================================================

interface IDocumento {
  quoteId: string;
  tipo: 'Orden de compra' | 'Invoice' | 'Packing List' | 'Certificado de Origen' | 'Póliza de seguro' | 'Guía de Despacho' | 'Declaración de Ingreso';
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoBytes: number;
  contenidoBase64?: string;
  r2Key?: string;
  subidoPor: string;
  usuarioId: string;
}

interface IDocumentoDoc extends IDocumento, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type DocumentoModel = mongoose.Model<IDocumentoDoc>;

const DocumentoSchema = new mongoose.Schema<IDocumentoDoc>(
  {
    quoteId: { type: String, required: true, index: true },
    tipo: { 
      type: String, 
      required: true,
      enum: ['Orden de compra', 'Invoice', 'Packing List', 'Certificado de Origen', 'Póliza de seguro', 'Guía de Despacho', 'Declaración de Ingreso']
    },
    nombreArchivo: { type: String, required: true },
    tipoArchivo: { type: String, required: true },
    tamanoBytes: { type: Number, required: true },
    contenidoBase64: { type: String },
    r2Key: { type: String },
    subidoPor: { type: String, required: true },
    usuarioId: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

DocumentoSchema.index({ quoteId: 1, usuarioId: 1 });

const Documento = (mongoose.models.Documento || 
  mongoose.model<IDocumentoDoc>('Documento', DocumentoSchema)) as DocumentoModel;

// ============================================================
// MODELO DE ARCHIVOS DE PROVEEDORES
// ============================================================

interface IProveedorArchivo {
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoBytes: number;
  contenidoBase64: string;
  categoria: 'AEREO' | 'FCL' | 'LCL';
  subidoPor: string;
  proveedorNombre: string;
}

interface IProveedorArchivoDoc extends IProveedorArchivo, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type ProveedorArchivoModel = mongoose.Model<IProveedorArchivoDoc>;

const ProveedorArchivoSchema = new mongoose.Schema<IProveedorArchivoDoc>(
  {
    nombreArchivo: { type: String, required: true },
    tipoArchivo: { type: String, required: true },
    tamanoBytes: { type: Number, required: true },
    contenidoBase64: { type: String, required: true },
    categoria: { type: String, required: true, enum: ['AEREO', 'FCL', 'LCL'] },
    subidoPor: { type: String, required: true, index: true },
    proveedorNombre: { type: String, required: true },
  },
  { timestamps: true }
);

ProveedorArchivoSchema.index({ subidoPor: 1, categoria: 1 });

const ProveedorArchivo = (mongoose.models.ProveedorArchivo ||
  mongoose.model<IProveedorArchivoDoc>('ProveedorArchivo', ProveedorArchivoSchema)) as ProveedorArchivoModel;

// ============================================================
// MODELO DE PDF DE COTIZACIONES
// ============================================================

interface IQuotePDF {
  quoteNumber: string;
  nombreArchivo: string;
  tamanoBytes: number;
  contenidoBase64?: string;          // Legacy – ya no se usa para nuevos PDFs
  r2Key?: string;                    // Clave del objeto en Cloudflare R2
  tipoServicio: 'AIR' | 'FCL' | 'LCL' | 'INTERNACIONALIZACION' | 'LASTMILE';
  origen: string;
  destino: string;
  usuarioId: string;
  subidoPor: string;
}

interface IQuotePDFDoc extends IQuotePDF, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type QuotePDFModel = mongoose.Model<IQuotePDFDoc>;

const QuotePDFSchema = new mongoose.Schema<IQuotePDFDoc>(
  {
    quoteNumber: { type: String, required: true, index: true },
    nombreArchivo: { type: String, required: true },
    tamanoBytes: { type: Number, required: true },
    contenidoBase64: { type: String },   // Legacy – opcional
    r2Key: { type: String },             // Cloudflare R2 object key
    tipoServicio: { type: String, required: true, enum: ['AIR', 'FCL', 'LCL', 'INTERNACIONALIZACION', 'LASTMILE'] },
    origen: { type: String, default: '' },
    destino: { type: String, default: '' },
    usuarioId: { type: String, required: true, index: true },
    subidoPor: { type: String, required: true },
  },
  { timestamps: true }
);

QuotePDFSchema.index({ quoteNumber: 1, usuarioId: 1 }, { unique: true });

const QuotePDF = (mongoose.models.QuotePDF || 
  mongoose.model<IQuotePDFDoc>('QuotePDF', QuotePDFSchema)) as QuotePDFModel;

  // ============================================================
// CONSTANTES PARA DOCUMENTOS
// ============================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// ============================================================
// FUNCIONES AUXILIARES PARA DOCUMENTOS
// ============================================================

function validateBase64(base64String: string): boolean {
  try {
    if (!base64String.includes('base64,')) {
      return false;
    }
    const base64Content = base64String.split('base64,')[1];
    const decoded = Buffer.from(base64Content, 'base64').toString('base64');
    return decoded === base64Content;
  } catch {
    return false;
  }
}

function getBase64Size(base64String: string): number {
  const base64Content = base64String.split('base64,')[1];
  const padding = (base64Content.match(/=/g) || []).length;
  return (base64Content.length * 3) / 4 - padding;
}

function getMimeTypeFromBase64(base64String: string): string | null {
  const match = base64String.match(/data:([^;]+);base64,/);
  return match ? match[1] : null;
}

// ============================================================
// MODELO DE AUDITORÍA
// ============================================================

interface IAuditLog {
  usuario: string;
  email: string;
  rol: 'cliente' | 'ejecutivo';
  ejecutivo: string | null;
  ejecutivoEmail: string | null;
  accion: string;
  categoria: string;
  descripcion: string;
  detalles: Record<string, unknown>;
  clienteAfectado: string | null;
  ip: string | null;
}

interface IAuditLogDoc extends IAuditLog, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type AuditLogModel = mongoose.Model<IAuditLogDoc>;

const AuditLogSchema = new mongoose.Schema<IAuditLogDoc>(
  {
    usuario: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    rol: { type: String, required: true, enum: ['cliente', 'ejecutivo'] },
    ejecutivo: { type: String, default: null },
    ejecutivoEmail: { type: String, default: null },
    accion: { type: String, required: true, index: true },
    categoria: { type: String, required: true, index: true },
    descripcion: { type: String, required: true },
    detalles: { type: mongoose.Schema.Types.Mixed, default: {} },
    clienteAfectado: { type: String, default: null, index: true },
    ip: { type: String, default: null },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ categoria: 1, createdAt: -1 });
AuditLogSchema.index({ usuario: 1, createdAt: -1 });

const AuditLog = (mongoose.models.AuditLog || mongoose.model<IAuditLogDoc>('AuditLog', AuditLogSchema)) as AuditLogModel;

// ============================================================
// MODELO QUOTE BEHAVIOR TRACKING
// ============================================================

interface IQuoteTrackingEvent {
  clientEmail: string;
  clientUsername: string;
  sessionId: string;
  event: 'QUOTE_STARTED' | 'QUOTE_STEP_CHANGED' | 'QUOTE_ROUTE_SELECTED' | 'QUOTE_COMPLETED' | 'QUOTE_ABANDONED';
  quoteType: 'AIR' | 'FCL' | 'LCL' | 'LASTMILE';
  step?: { step: string; stepNumber: number; totalSteps: number };
  route?: { origin: string; destination: string };
  incoterm?: string;
  container?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

interface IQuoteTrackingEventDoc extends IQuoteTrackingEvent, mongoose.Document {
  createdAt: Date;
}

type QuoteTrackingEventModel = mongoose.Model<IQuoteTrackingEventDoc>;

const QuoteTrackingEventSchema = new mongoose.Schema<IQuoteTrackingEventDoc>(
  {
    clientEmail: { type: String, required: true, lowercase: true, trim: true },
    clientUsername: { type: String, required: true, trim: true },
    sessionId: { type: String, required: true },
    event: {
      type: String,
      required: true,
      enum: ['QUOTE_STARTED', 'QUOTE_STEP_CHANGED', 'QUOTE_ROUTE_SELECTED', 'QUOTE_COMPLETED', 'QUOTE_ABANDONED'],
    },
    quoteType: { type: String, required: true, enum: ['AIR', 'FCL', 'LCL', 'LASTMILE'] },
    step: {
      step: String,
      stepNumber: Number,
      totalSteps: Number,
    },
    route: {
      origin: String,
      destination: String,
    },
    incoterm: String,
    container: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true }
);

QuoteTrackingEventSchema.index({ clientEmail: 1, timestamp: -1 });
QuoteTrackingEventSchema.index({ clientUsername: 1, timestamp: -1 });
QuoteTrackingEventSchema.index({ sessionId: 1, timestamp: 1 });
QuoteTrackingEventSchema.index({ event: 1, quoteType: 1 });
QuoteTrackingEventSchema.index({ timestamp: -1 });

const QuoteTrackingEvent = (mongoose.models.QuoteTrackingEvent || mongoose.model<IQuoteTrackingEventDoc>('QuoteTrackingEvent', QuoteTrackingEventSchema)) as QuoteTrackingEventModel;

// ============================================================
// MODELO EXECUTIVE NOTIFICATION (alertas en navbar para ejecutivos)
// TTL: 72h auto-expire via MongoDB index on createdAt
// ============================================================

type PortalNotificationAudience = 'EJECUTIVO' | 'CLIENTE' | 'OPERACIONES';
type PortalNotificationType =
  | 'QUOTE_COMPLETED'
  | 'QUOTE_ABANDONED'
  | 'TRACKING_CREATED'
  | 'TRACKING_STATUS_CHANGED'
  | 'TRACKING_DELAYED'
  | 'CLIENT_ASSIGNED'
  | 'CLIENT_COLD';

interface IPortalNotification {
  audience: PortalNotificationAudience;
  recipientEmail: string;
  recipientUsername?: string;
  type: PortalNotificationType;
  dedupKey: string;
  sessionId?: string;
  quoteType?: 'AIR' | 'FCL' | 'LCL' | 'LASTMILE';
  quoteNumber?: string;
  route?: { origin?: string; destination?: string };
  shipmentMode?: 'AIR' | 'OCEAN';
  shipmentId?: string;
  reference?: string;
  awbNumber?: string;
  containerNumber?: string;
  oldStatus?: string;
  newStatus?: string;
  clientEmail?: string;
  clientUsername?: string;
  clientNombre?: string;
  payload?: Record<string, unknown>;
  read: boolean;
  readAt?: Date;
  expiresAt?: Date; // optional per-document TTL (overrides 72h default when set)
}

interface IPortalNotificationDoc extends IPortalNotification, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type PortalNotificationModel = mongoose.Model<IPortalNotificationDoc>;

const PortalNotificationSchema = new mongoose.Schema<IPortalNotificationDoc>(
  {
    audience: { type: String, required: true, enum: ['EJECUTIVO', 'CLIENTE', 'OPERACIONES'], index: true },
    recipientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    recipientUsername: { type: String, trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        'QUOTE_COMPLETED', 'QUOTE_ABANDONED',
        'TRACKING_CREATED', 'TRACKING_STATUS_CHANGED', 'TRACKING_DELAYED',
        'CLIENT_ASSIGNED', 'CLIENT_COLD',
      ],
    },
    dedupKey: { type: String, required: true },
    sessionId: { type: String },
    quoteType: { type: String, enum: ['AIR', 'FCL', 'LCL', 'LASTMILE'] },
    quoteNumber: { type: String, trim: true },
    route: {
      origin: { type: String, trim: true },
      destination: { type: String, trim: true },
    },
    shipmentMode: { type: String, enum: ['AIR', 'OCEAN'] },
    shipmentId: { type: String, trim: true },
    reference: { type: String, trim: true },
    awbNumber: { type: String, trim: true },
    containerNumber: { type: String, trim: true },
    oldStatus: { type: String, trim: true },
    newStatus: { type: String, trim: true },
    clientEmail: { type: String, lowercase: true, trim: true },
    clientUsername: { type: String, trim: true },
    clientNombre: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PortalNotificationSchema.index({ recipientEmail: 1, dedupKey: 1 }, { unique: true });
PortalNotificationSchema.index({ recipientEmail: 1, createdAt: -1 });
PortalNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 72 });
PortalNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PortalNotification = (mongoose.models.PortalNotification ||
  mongoose.model<IPortalNotificationDoc>('PortalNotification', PortalNotificationSchema)) as PortalNotificationModel;

async function upsertPortalNotification(doc: Partial<IPortalNotification> & {
  audience: PortalNotificationAudience;
  recipientEmail: string;
  type: PortalNotificationType;
  dedupKey: string;
}): Promise<void> {
  try {
    const recipient = String(doc.recipientEmail).toLowerCase().trim();
    if (!recipient) return;
    const { audience, type, dedupKey, ...rest } = doc;
    await PortalNotification.updateOne(
      { recipientEmail: recipient, dedupKey },
      {
        $set: {
          ...rest,
          audience,
          type,
          recipientEmail: recipient,
          read: false,
          readAt: undefined,
          updatedAt: new Date(),
        },
        $setOnInsert: { dedupKey, createdAt: new Date() },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error('[portal-notification] upsert failed:', err);
  }
}

async function emitQuoteEventNotification(opts: {
  clientEmail: string;
  clientUsername: string;
  sessionId: string;
  event: 'QUOTE_COMPLETED' | 'QUOTE_ABANDONED';
  quoteType: 'AIR' | 'FCL' | 'LCL' | 'LASTMILE';
  route?: { origin?: string; destination?: string };
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const clientEmail = String(opts.clientEmail).toLowerCase().trim();
    const clientUser = await User.findOne({ email: clientEmail }).populate('ejecutivoId');
    if (!clientUser?.ejecutivoId) return;
    const ej = clientUser.ejecutivoId as unknown as IEjecutivoDoc | null;
    const ejecutivoEmail = ej?.email ? String(ej.email).toLowerCase().trim() : null;
    if (!ejecutivoEmail) return;

    const quoteNumber = (opts.metadata && typeof (opts.metadata as any).quoteNumber === 'string')
      ? (opts.metadata as any).quoteNumber as string
      : undefined;

    await upsertPortalNotification({
      audience: 'EJECUTIVO',
      recipientEmail: ejecutivoEmail,
      type: opts.event,
      dedupKey: `QUOTE:${opts.sessionId}`,
      sessionId: opts.sessionId,
      quoteType: opts.quoteType,
      quoteNumber,
      route: opts.route,
      clientEmail,
      clientUsername: opts.clientUsername,
      clientNombre: clientUser.nombreuser || undefined,
      payload: { route: '/admin/comportamiento-clientes', clientUsername: opts.clientUsername },
    });
  } catch (err) {
    console.error('[portal-notification] quote emit failed:', err);
  }
}

async function emitTrackingNotification(opts: {
  type: 'TRACKING_CREATED' | 'TRACKING_STATUS_CHANGED' | 'TRACKING_DELAYED';
  shipmentMode: 'AIR' | 'OCEAN';
  shipmentId: string;
  reference: string;
  awbNumber?: string;
  containerNumber?: string;
  oldStatus?: string;
  newStatus?: string;
}): Promise<void> {
  try {
    const reference = String(opts.reference || '').trim();
    if (!reference) return;

    const clientUser = await User.findOne({
      $or: [{ username: reference }, { usernames: reference }],
    }).populate('ejecutivoId');

    const dedupKey = `${opts.type}:${opts.shipmentMode}:${opts.shipmentId}${opts.newStatus ? ':' + opts.newStatus : ''}`;

    const baseDoc = {
      type: opts.type,
      dedupKey,
      shipmentMode: opts.shipmentMode,
      shipmentId: String(opts.shipmentId),
      reference,
      awbNumber: opts.awbNumber,
      containerNumber: opts.containerNumber,
      oldStatus: opts.oldStatus,
      newStatus: opts.newStatus,
      clientEmail: clientUser?.email,
      clientUsername: clientUser?.username,
      clientNombre: clientUser?.nombreuser,
    } as Partial<IPortalNotification>;

    if (clientUser?.email) {
      await upsertPortalNotification({
        ...baseDoc,
        audience: 'CLIENTE',
        recipientEmail: clientUser.email,
        recipientUsername: clientUser.username,
        type: opts.type,
        dedupKey,
        payload: { route: '/shipsgo', shipmentMode: opts.shipmentMode, shipmentId: opts.shipmentId },
      });
    }

    if (clientUser?.ejecutivoId) {
      const ej = clientUser.ejecutivoId as unknown as IEjecutivoDoc | null;
      const ejecutivoEmail = ej?.email ? String(ej.email).toLowerCase().trim() : null;
      if (ejecutivoEmail) {
        await upsertPortalNotification({
          ...baseDoc,
          audience: 'EJECUTIVO',
          recipientEmail: ejecutivoEmail,
          type: opts.type,
          dedupKey,
          payload: {
            route: '/admin/home',
            openModal: 'all-trackings',
            modalTab: opts.shipmentMode === 'AIR' ? 'air' : 'ocean',
          },
        });
      }
    }

    const opsExecs = await Ejecutivo.find({ activo: true, 'roles.operaciones': true }, { email: 1 }).lean();
    for (const opEj of opsExecs) {
      const email = (opEj as any)?.email ? String((opEj as any).email).toLowerCase().trim() : null;
      if (!email) continue;
      await upsertPortalNotification({
        ...baseDoc,
        audience: 'OPERACIONES',
        recipientEmail: email,
        type: opts.type,
        dedupKey,
        payload: {
          route: '/admin/home',
          openModal: 'all-shipments',
          modalTab: opts.shipmentMode === 'AIR' ? 'air' : 'ocean',
        },
      });
    }
  } catch (err) {
    console.error('[portal-notification] tracking emit failed:', err);
  }
}

async function emitClientAssignedNotification(opts: {
  ejecutivoObjectId: mongoose.Types.ObjectId | string;
  client: { email: string; username: string; nombreuser?: string; _id: mongoose.Types.ObjectId | string };
}): Promise<void> {
  try {
    const ej = await Ejecutivo.findById(opts.ejecutivoObjectId).lean();
    const ejecutivoEmail = (ej as any)?.email ? String((ej as any).email).toLowerCase().trim() : null;
    if (!ejecutivoEmail) return;

    await upsertPortalNotification({
      audience: 'EJECUTIVO',
      recipientEmail: ejecutivoEmail,
      type: 'CLIENT_ASSIGNED',
      dedupKey: `CLIENT_ASSIGNED:${String(opts.client._id)}:${String(opts.ejecutivoObjectId)}`,
      clientEmail: opts.client.email,
      clientUsername: opts.client.username,
      clientNombre: opts.client.nombreuser,
      payload: { route: '/admin/home', openModal: 'all-clients' },
    });
  } catch (err) {
    console.error('[portal-notification] client-assigned emit failed:', err);
  }
}

// ============================================================
// CLIENT TEMPERATURE (frío / tibio / caliente / más abandonos)
// ============================================================
type ClientTemperatureBucket = 'frio' | 'tibio' | 'caliente' | 'new';

interface ClientTemperatureRecord {
  email: string;
  username: string;
  usernames: string[];
  nombreuser: string;
  ejecutivoEmail: string | null;
  createdAt: Date;
  completed30d: number;
  consecutiveAbandons: number;
  bucket: ClientTemperatureBucket;
  isCold: boolean;
  isHotAbandons: boolean;
  lastActivity: Date | null;
  lastCompletedAt: Date | null;
}

interface TemperatureUserInput {
  email: string;
  username: string;
  usernames?: string[];
  nombreuser?: string;
  createdAt?: Date | null;
  ejecutivoEmail?: string | null;
}

async function buildClientTemperatureRecords(
  users: TemperatureUserInput[],
  now: Date = new Date(),
): Promise<ClientTemperatureRecord[]> {
  if (users.length === 0) return [];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const emails = users.map((u) => String(u.email).toLowerCase().trim()).filter(Boolean);
  if (emails.length === 0) return [];

  const sessions = await QuoteTrackingEvent.aggregate([
    { $match: { clientEmail: { $in: emails } } },
    {
      $group: {
        _id: { email: '$clientEmail', sessionId: '$sessionId' },
        hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
        hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
        lastActivity: { $max: '$timestamp' },
      },
    },
    {
      $project: {
        _id: 0,
        email: '$_id.email',
        status: {
          $cond: [
            { $eq: ['$hasCompleted', 1] }, 'completed',
            { $cond: [{ $eq: ['$hasAbandoned', 1] }, 'abandoned', 'in_progress'] },
          ],
        },
        lastActivity: 1,
      },
    },
    { $sort: { lastActivity: -1 } },
  ]);

  const byEmail = new Map<string, Array<{ status: string; lastActivity: Date }>>();
  for (const s of sessions as any[]) {
    const arr = byEmail.get(s.email) || [];
    arr.push({ status: s.status, lastActivity: new Date(s.lastActivity) });
    byEmail.set(s.email, arr);
  }

  return users.map((u): ClientTemperatureRecord => {
    const email = String(u.email).toLowerCase().trim();
    const userSessions = byEmail.get(email) || [];

    const completed30d = userSessions.filter(
      (s) => s.status === 'completed' && s.lastActivity >= thirtyDaysAgo,
    ).length;

    let consecutiveAbandons = 0;
    for (const s of userSessions) {
      if (s.status === 'completed') break;
      if (s.status === 'abandoned') consecutiveAbandons++;
    }

    const lastCompleted = userSessions.find((s) => s.status === 'completed');
    const lastAny = userSessions[0];
    const accountCreatedAt = u.createdAt ? new Date(u.createdAt) : new Date(0);
    const accountAgeMet = accountCreatedAt.getTime() <= thirtyDaysAgo.getTime();

    let bucket: ClientTemperatureBucket;
    if (completed30d >= 3) bucket = 'caliente';
    else if (completed30d >= 1) bucket = 'tibio';
    else if (accountAgeMet) bucket = 'frio';
    else bucket = 'new';

    return {
      email: u.email,
      username: u.username,
      usernames: Array.isArray(u.usernames) ? u.usernames : [],
      nombreuser: u.nombreuser || '',
      ejecutivoEmail: u.ejecutivoEmail ?? null,
      createdAt: accountCreatedAt,
      completed30d,
      consecutiveAbandons,
      bucket,
      isCold: bucket === 'frio',
      isHotAbandons: consecutiveAbandons > 3,
      lastActivity: lastAny?.lastActivity ?? null,
      lastCompletedAt: lastCompleted?.lastActivity ?? null,
    };
  });
}

function summarizeTemperature(records: ClientTemperatureRecord[]) {
  const frioList = records.filter((r) => r.bucket === 'frio');
  const tibioList = records.filter((r) => r.bucket === 'tibio');
  const calienteList = records.filter((r) => r.bucket === 'caliente');
  const masAbandonosList = records.filter((r) => r.isHotAbandons);
  return {
    counts: {
      frio: frioList.length,
      tibio: tibioList.length,
      caliente: calienteList.length,
      masAbandonos: masAbandonosList.length,
    },
    lists: {
      frio: frioList,
      tibio: tibioList,
      caliente: calienteList,
      masAbandonos: masAbandonosList,
    },
  };
}

async function emitColdClientNotifications(
  records: ClientTemperatureRecord[],
  now: Date = new Date(),
): Promise<{ emitted: number }> {
  const today = now.toISOString().slice(0, 10);
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  let emitted = 0;
  for (const r of records) {
    if (!r.isCold) continue;
    const ejecutivoEmail = r.ejecutivoEmail ? String(r.ejecutivoEmail).toLowerCase().trim() : '';
    if (!ejecutivoEmail) continue;
    try {
      const referenceDate = r.lastActivity ?? r.createdAt;
      const daysSince = referenceDate
        ? Math.floor((now.getTime() - referenceDate.getTime()) / 86400000)
        : null;
      await upsertPortalNotification({
        audience: 'EJECUTIVO',
        recipientEmail: ejecutivoEmail,
        type: 'CLIENT_COLD',
        dedupKey: `CLIENT_COLD:${r.email.toLowerCase()}:${today}`,
        clientEmail: r.email,
        clientUsername: r.username,
        clientNombre: r.nombreuser,
        payload: {
          route: '/admin/comportamiento-clientes',
          clientUsername: r.username,
          daysSinceActivity: daysSince,
          hasEverQuoted: r.lastActivity !== null,
          accountCreatedAt: r.createdAt.toISOString(),
        },
        expiresAt,
      });
      emitted++;
    } catch (err) {
      console.error('[portal-notification] cold client emit failed:', err);
    }
  }
  return { emitted };
}

// ============================================================
// MODELO AGENCIA DE ADUANAS - CONFIG (Singleton)
// ============================================================
import {
  AgenciaAduanaConfigSchema,
  DEFAULT_CONFIG,
  type IAgenciaAduanaConfigDoc,
  type AgenciaAduanaConfigModel,
} from '../api/models/AgenciaAduanaConfig.ts';

const AgenciaAduanaConfig = (
  mongoose.models.AgenciaAduanaConfig ||
  mongoose.model<IAgenciaAduanaConfigDoc>('AgenciaAduanaConfig', AgenciaAduanaConfigSchema)
) as AgenciaAduanaConfigModel;

// ============================================================
// MODELO AGENCIA DE ADUANAS FCL - CONFIG (Singleton, colección separada)
// ============================================================
import {
  AgenciaAduanaFclConfigSchema,
  DEFAULT_FCL_CONFIG,
  type IAgenciaAduanaFclConfigDoc,
  type AgenciaAduanaFclConfigModel,
} from '../api/models/AgenciaAduanaFclConfig.ts';

const AgenciaAduanaFclConfig = (
  mongoose.models.AgenciaAduanaFclConfig ||
  mongoose.model<IAgenciaAduanaFclConfigDoc>(
    'AgenciaAduanaFclConfig',
    AgenciaAduanaFclConfigSchema,
  )
) as AgenciaAduanaFclConfigModel;

// ============================================================
// MODELO AGENCIA DE ADUANAS LCL - CONFIG (Singleton, colección separada)
// ============================================================
import {
  AgenciaAduanaLclConfigSchema,
  DEFAULT_LCL_CONFIG,
  type IAgenciaAduanaLclConfigDoc,
  type AgenciaAduanaLclConfigModel,
} from '../api/models/AgenciaAduanaLclConfig.ts';

const AgenciaAduanaLclConfig = (
  mongoose.models.AgenciaAduanaLclConfig ||
  mongoose.model<IAgenciaAduanaLclConfigDoc>(
    'AgenciaAduanaLclConfig',
    AgenciaAduanaLclConfigSchema,
  )
) as AgenciaAduanaLclConfigModel;

// ============================================================
// MODELO GESTIÓN COTIZADOR - CONFIG (Singleton, colección gestioncotizador)
// ============================================================
import {
  GestionCotizadorConfigSchema,
  DEFAULT_GESTION_COTIZADOR_CONFIG,
  type IGestionCotizadorConfigDoc,
  type GestionCotizadorConfigModel,
  type IFclCotizadorConfig,
  type ILclCotizadorConfig,
  type ILclDeliveryBracket,
  type IAereoCotizadorConfig,
  type IAereoTtBracket,
} from '../api/models/GestionCotizadorConfig.ts';

const GestionCotizadorConfig = (
  mongoose.models.GestionCotizadorConfig ||
  mongoose.model<IGestionCotizadorConfigDoc>(
    'GestionCotizadorConfig',
    GestionCotizadorConfigSchema,
  )
) as GestionCotizadorConfigModel;

// ============================================================
// MODELO FCL EXW - CONFIG (Singleton, colección fcl_exw_config)
// ============================================================
import {
  FclExwConfigSchema,
  DEFAULT_FCL_EXW_CONFIG,
  type IFclExwConfigDoc,
  type FclExwConfigModel,
  type IFclExwConfig,
} from '../api/models/FclExwConfig.ts';

const FclExwConfig = (
  mongoose.models.FclExwConfig ||
  mongoose.model<IFclExwConfigDoc>('FclExwConfig', FclExwConfigSchema)
) as FclExwConfigModel;

// ============================================================
// MODELO OPERACIÓN + CLIENTE-PROVEEDOR
// ============================================================
import {
  OperacionSchema,
  type IOperacionDoc,
  type OperacionModel,
} from '../api/models/Operacion.ts';
import {
  ClienteProveedorSchema,
  normalizeEmpresaName,
  type IClienteProveedorDoc,
  type ClienteProveedorModel,
} from '../api/models/ClienteProveedor.ts';

const Operacion = (
  mongoose.models.Operacion ||
  mongoose.model<IOperacionDoc>('Operacion', OperacionSchema)
) as OperacionModel;

const ClienteProveedor = (
  mongoose.models.ClienteProveedor ||
  mongoose.model<IClienteProveedorDoc>('ClienteProveedor', ClienteProveedorSchema)
) as ClienteProveedorModel;

// ============================================================
// MODELO ALUMNOS PRÁCTICA
// ============================================================
interface IAlumnoPuntaje {
  puntaje: number;
  tipoEntrenamiento: string;
  fecha: Date;
}

interface IAlumno {
  nombre: string;
  tipoEntrenamiento: string;
  puntajeTotal: number;
  historial: IAlumnoPuntaje[];
  activo: boolean;
}

interface IAlumnoDoc extends IAlumno, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
}

type AlumnoModel = mongoose.Model<IAlumnoDoc>;

const AlumnoPuntajeSchema = new mongoose.Schema({
  puntaje: { type: Number, required: true },
  tipoEntrenamiento: { type: String, required: true, trim: true },
  fecha: { type: Date, default: Date.now },
}, { _id: true });

const AlumnoSchema = new mongoose.Schema<IAlumnoDoc>(
  {
    nombre: { type: String, required: true, trim: true },
    tipoEntrenamiento: { type: String, required: true, trim: true },
    puntajeTotal: { type: Number, default: 0 },
    historial: { type: [AlumnoPuntajeSchema], default: [] },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AlumnoSchema.index({ puntajeTotal: -1 });
AlumnoSchema.index({ nombre: 1 });

const Alumno = (mongoose.models.Alumno || mongoose.model<IAlumnoDoc>('Alumno', AlumnoSchema)) as AlumnoModel;

// Conectar a MongoDB
mongoose
  .connect(MONGODB_URI, { bufferCommands: false })
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
  })
  .catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  });

/** =========================
 *  Middleware de autenticación
 *  ========================= */
const auth: express.RequestHandler = (req, res, next) => {
  const h = req.headers.authorization || '';
  console.log('Auth header:', h ? 'Present' : 'Missing');
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'No auth token' });
  }

  try {
    console.log('Token length:', token.length);
    const decoded = verifyToken(token);
    console.log('Token decoded, user sub:', decoded.sub);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.log('Token verification failed:', (err as Error).message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/** =========================
 *  Rutas
 *  ========================= */

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, turnstileToken } = (req.body as any) || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan campos' });
    }

    const lookupEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: lookupEmail }).populate('ejecutivoId');

    if (!user) {
      console.log('[login] email no encontrado:', lookupEmail);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.passwordHash) {
      console.error('[login] passwordHash ausente para', user.email);
      return res.status(500).json({ error: 'Usuario mal configurado' });
    }

    // --- Verificación Turnstile ---
    if (user.loginCaptchaRequired) {
      if (!turnstileToken) {
        return res.status(403).json({
          error: 'Se requiere verificación de seguridad. Por favor completa el captcha.',
          requiresCaptcha: true,
        });
      }
      const remoteip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
      const captchaOk = await verifyTurnstile(String(turnstileToken), remoteip);
      if (!captchaOk) {
        return res.status(400).json({
          error: 'Verificación de seguridad inválida. Por favor, inténtalo de nuevo.',
          requiresCaptcha: true,
        });
      }
      // Token válido: reiniciar contador para dar ventana fresca de 3 intentos
      user.loginFailCount = 0;
      user.loginCaptchaRequired = false;
      await User.updateOne(
        { email: lookupEmail },
        { $set: { loginFailCount: 0, loginCaptchaRequired: false } }
      );
    }

    const ok = bcrypt.compareSync(String(password), user.passwordHash);
    if (!ok) {
      console.log('[login] password incorrecto para', user.email);
      const newFailCount = (user.loginFailCount ?? 0) + 1;
      const newCaptchaRequired = newFailCount >= 3;
      await User.updateOne(
        { email: lookupEmail },
        { $set: { loginFailCount: newFailCount, loginCaptchaRequired: newCaptchaRequired } }
      );
      return res.status(401).json({
        error: 'Credenciales inválidas',
        requiresCaptcha: newCaptchaRequired,
        failCount: newFailCount,
      });
    }

    const token = signToken({ sub: user.email, username: user.username });

    // Login exitoso: reiniciar contador de fallos
    await User.updateOne(
      { email: lookupEmail },
      { $set: { loginFailCount: 0, loginCaptchaRequired: false } }
    );
    
    // Retornar datos del ejecutivo si existe
    const ejecutivo = user.ejecutivoId as any;

    // Buscar roles del ejecutivo (por populate o por email)
    let roles = null;
    if (user.username === 'Ejecutivo') {
      let ejDoc = ejecutivo;
      if (!ejDoc || !ejDoc._id) {
        ejDoc = await Ejecutivo.findOne({ email: user.email });
      }
      if (ejDoc) {
        roles = {
          administrador: ejDoc.roles?.administrador || false,
          pricing: ejDoc.roles?.pricing || false,
          ejecutivo: ejDoc.roles?.ejecutivo !== false, // default true
          proveedor: ejDoc.roles?.proveedor || false,
          operaciones: ejDoc.roles?.operaciones || false,
        };
      }
    }

    // Construir usernames: usar el array si existe, sino fallback a [username]
    const usernames = (user.usernames && user.usernames.length > 0)
      ? user.usernames
      : [user.username];

    return res.json({
      token,
      user: { 
        email: user.email, 
        username: user.username,
        usernames,
        nombreuser: user.nombreuser,
        ejecutivo: ejecutivo ? {
          id: ejecutivo._id,
          nombre: ejecutivo.nombre,
          email: ejecutivo.email,
          telefono: ejecutivo.telefono
        } : null,
        roles,
      },
    });
  } catch (e) {
    console.error('[login] error inesperado:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Cambiar contraseña
app.post('/api/change-password', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const { currentPassword, newPassword } = (req.body as any) || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Debes ingresar la contraseña actual y la nueva.' });
    }

    const user = await User.findOne({ email: currentUser.sub });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (!user.passwordHash) {
      return res.status(500).json({ error: 'Usuario mal configurado.' });
    }

    const ok = bcrypt.compareSync(String(currentPassword), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    user.passwordHash = bcrypt.hashSync(String(newPassword), 12);
    await user.save();

    return res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  } catch (e) {
    console.error('[change-password] error:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Verificar token
app.get('/api/me', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const user = await User.findOne({ email: currentUser.sub }).populate('ejecutivoId');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Retornar datos del ejecutivo si existe
    const ejecutivo = user.ejecutivoId as any;

    // Buscar roles del ejecutivo
    let roles = null;
    if (user.username === 'Ejecutivo') {
      let ejDoc = ejecutivo;
      if (!ejDoc || !ejDoc._id) {
        ejDoc = await Ejecutivo.findOne({ email: user.email });
      }
      if (ejDoc) {
        roles = {
          administrador: ejDoc.roles?.administrador || false,
          pricing: ejDoc.roles?.pricing || false,
          ejecutivo: ejDoc.roles?.ejecutivo !== false,
          proveedor: ejDoc.roles?.proveedor || false,
          operaciones: ejDoc.roles?.operaciones || false,
        };
      }
    }

    // Construir usernames: usar el array si existe, sino fallback a [username]
    const usernames = (user.usernames && user.usernames.length > 0)
      ? user.usernames
      : [user.username];

    res.json({ 
      user: {
        sub: user.email,
        username: user.username,
        usernames,
        nombreuser: user.nombreuser,
        ejecutivo: ejecutivo ? {
          id: ejecutivo._id,
          nombre: ejecutivo.nombre,
          email: ejecutivo.email,
          telefono: ejecutivo.telefono
        } : null,
        roles,
      }
    });
  } catch (e) {
    console.error('[me] error:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/api/tracking-email-preferences', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const reference = String(req.query.reference || '').trim();

    if (!reference) {
      return res.status(400).json({ error: 'reference es un parámetro requerido' });
    }

    const canManageReference = await canManageShipsgoReference(
      currentUser,
      reference,
    );

    if (!canManageReference) {
      return res.status(403).json({
        error: 'No puedes acceder a las configuraciones de otra cuenta',
      });
    }

    const preference = await TrackingEmailPreference.findOne({ reference }).lean();

    return res.json({
      success: true,
      preference: {
        reference,
        emails: preference?.emails || [],
        phones: preference?.phones || [],
        updatedAt: preference?.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('[tracking-email-preferences:get] error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/api/tracking-email-preferences', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const reference = String(req.body?.reference || '').trim();
    const hasEmails = req.body?.emails !== undefined;
    const hasPhones = req.body?.phones !== undefined;

    if (!reference) {
      return res.status(400).json({ error: 'reference es un campo requerido' });
    }

    if (!hasEmails && !hasPhones) {
      return res.status(400).json({
        error: 'Debes enviar emails y/o phones para actualizar la configuración',
      });
    }

    const canManageReference = await canManageShipsgoReference(
      currentUser,
      reference,
    );

    if (!canManageReference) {
      return res.status(403).json({
        error: 'No puedes modificar las configuraciones de otra cuenta',
      });
    }

    const existing = await TrackingEmailPreference.findOne({ reference }).lean();
    let nextEmails = existing?.emails || [];
    let nextPhones = existing?.phones || [];

    if (hasEmails) {
      const validation = validateTrackingPreferenceEmails(req.body?.emails);

      if (validation.error || !validation.emails) {
        return res.status(400).json({ error: validation.error || 'emails inválidos' });
      }

      nextEmails = validation.emails;
    }

    if (hasPhones) {
      const phoneValidation = validateTrackingPreferencePhones(req.body?.phones);

      if (phoneValidation.error || !phoneValidation.phones) {
        return res.status(400).json({
          error: phoneValidation.error || 'phones inválidos',
        });
      }

      nextPhones = phoneValidation.phones;
    }

    if (nextEmails.length === 0 && nextPhones.length === 0) {
      await TrackingEmailPreference.deleteOne({ reference });

      return res.json({
        success: true,
        preference: {
          reference,
          emails: [],
          phones: [],
          updatedAt: null,
        },
      });
    }

    const preference = await TrackingEmailPreference.findOneAndUpdate(
      { reference },
      {
        reference,
        emails: nextEmails,
        phones: nextPhones,
        updatedBy: currentUser.sub,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    return res.json({
      success: true,
      preference: {
        reference,
        emails: preference?.emails || [],
        phones: preference?.phones || [],
        updatedAt: preference?.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('[tracking-email-preferences:put] error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================================
// ENDPOINTS DEL EJECUTIVO (ver sus clientes)
// ============================================================

app.get('/api/ejecutivo/clientes', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;

    // Buscar el usuario logueado en la colección users
    const me = await User.findOne({ email: currentUser.sub }).populate('ejecutivoId');

    if (!me) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Resolver el _id del ejecutivo:
    // 1) si el user tiene ejecutivoId, usamos ese
    // 2) si no, intentamos encontrar un Ejecutivo cuyo email coincida con el del user logueado (caso "ejecutivo con cuenta")
    let ejecutivoObjectId: any = null;

    if (me.ejecutivoId) {
      // Cuando está populado, me.ejecutivoId es el doc; cuando no, es ObjectId.
      ejecutivoObjectId = (me.ejecutivoId as any)._id ?? me.ejecutivoId;
    } else {
      const lookupEmail = String(me.email).toLowerCase().trim();
      const ej = await Ejecutivo.findOne({ email: lookupEmail });
      if (ej) ejecutivoObjectId = ej._id;
    }

    if (!ejecutivoObjectId) {
      // No hay ejecutivo asociado => no hay clientes que mostrar
      return res.json({ success: true, clientes: [] });
    }

    // Buscar clientes asociados a ese ejecutivoId
    const clientes = await User.find(
      { ejecutivoId: ejecutivoObjectId, username: { $ne: 'Ejecutivo' } },
      { passwordHash: 0 }
    )
      .populate('ejecutivoId')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      clientes: clientes.map((u: any) => ({
        id: u._id,
        email: u.email,
        username: u.username,
        usernames: (u.usernames && u.usernames.length > 0) ? u.usernames : [u.username],
        nombreuser: u.nombreuser,
        createdAt: u.createdAt,
        ejecutivo: u.ejecutivoId ? {
          id: u.ejecutivoId._id,
          nombre: u.ejecutivoId.nombre,
          email: u.ejecutivoId.email,
          telefono: u.ejecutivoId.telefono
        } : null
      }))
    });
  } catch (e) {
    console.error('[ejecutivo] Error listando clientes:', e);
    return res.status(500).json({ error: 'Error al listar clientes del ejecutivo' });
  }
});

// GET /api/ejecutivo/activity-feed — Feed de actividad reciente de clientes
app.get('/api/ejecutivo/activity-feed', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const hoursRaw = parseInt(String(req.query.hours ?? '48'));
    const hours = isNaN(hoursRaw) ? 48 : Math.min(168, Math.max(1, hoursRaw));
    const limitRaw = parseInt(String(req.query.limit ?? '30'));
    const limit = isNaN(limitRaw) ? 30 : Math.min(100, Math.max(1, limitRaw));

    const me = await User.findOne({ email: currentUser.sub }).populate('ejecutivoId');
    if (!me) return res.status(404).json({ error: 'Usuario no encontrado' });

    let ejecutivoObjectId: any = null;
    if (me.ejecutivoId) {
      ejecutivoObjectId = (me.ejecutivoId as any)._id ?? me.ejecutivoId;
    } else {
      const ej = await Ejecutivo.findOne({ email: String(me.email).toLowerCase().trim() });
      if (ej) ejecutivoObjectId = ej._id;
    }

    if (!ejecutivoObjectId) return res.json({ feed: [] });

    const clients = await User.find(
      { ejecutivoId: ejecutivoObjectId, username: { $ne: 'Ejecutivo' } },
      { email: 1, username: 1, nombreuser: 1 }
    ).lean();

    if (clients.length === 0) return res.json({ feed: [] });

    const clientEmails = clients.map((c: any) => String(c.email).toLowerCase());
    const clientByEmail = new Map(
      clients.map((c: any) => [String(c.email).toLowerCase(), c])
    );

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const sessionAgg: Array<{
      clientEmail: string;
      sessionId: string;
      quoteType: string;
      hasCompleted: number;
      hasAbandoned: number;
      firstTimestamp: Date;
      lastTimestamp: Date;
      allRoutes: Array<{ origin?: string; destination?: string } | null>;
    }> = await QuoteTrackingEvent.aggregate([
      {
        $match: {
          clientEmail: { $in: clientEmails },
          timestamp: { $gte: since },
        },
      },
      {
        $group: {
          _id: { email: '$clientEmail', sessionId: '$sessionId' },
          quoteType: { $first: '$quoteType' },
          hasCompleted: {
            $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] },
          },
          hasAbandoned: {
            $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] },
          },
          firstTimestamp: { $min: '$timestamp' },
          lastTimestamp: { $max: '$timestamp' },
          allRoutes: { $push: '$route' },
        },
      },
      {
        $project: {
          _id: 0,
          clientEmail: '$_id.email',
          sessionId: '$_id.sessionId',
          quoteType: 1,
          hasCompleted: 1,
          hasAbandoned: 1,
          firstTimestamp: 1,
          lastTimestamp: 1,
          allRoutes: 1,
        },
      },
      { $sort: { lastTimestamp: -1 } },
      { $limit: limit },
    ]);

    const feed = sessionAgg.map((s) => {
      const client = clientByEmail.get(s.clientEmail) as any;
      const event =
        s.hasCompleted === 1
          ? 'QUOTE_COMPLETED'
          : s.hasAbandoned === 1
            ? 'QUOTE_ABANDONED'
            : 'QUOTE_STARTED';
      const route =
        (s.allRoutes || []).find(
          (r: any) => r && (r.origin || r.destination)
        ) || null;
      return {
        sessionId: s.sessionId,
        clientEmail: s.clientEmail,
        clientUsername: client?.username || s.clientEmail,
        clientNombre: client?.nombreuser || client?.username || s.clientEmail,
        event,
        quoteType: s.quoteType,
        route,
        startedAt: s.firstTimestamp,
        timestamp: s.lastTimestamp,
      };
    });

    return res.json({ feed });
  } catch (e) {
    console.error('[ejecutivo/activity-feed] error:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});


// ============================================================
// ENDPOINTS DE EJECUTIVOS
// ============================================================

// Listar ejecutivos (usuarios autenticados)
app.get('/api/ejecutivos', auth, async (req, res) => {
  try {
    const ejecutivos = await Ejecutivo.find({ activo: true, 'roles.ejecutivo': true }).sort({ nombre: 1 });

    return res.json({
      success: true,
      ejecutivos: ejecutivos.map(ej => ({
        id: ej._id,
        nombre: ej.nombre,
        email: ej.email,
        telefono: ej.telefono
      }))
    });
  } catch (e) {
    console.error('[ejecutivos] Error listando ejecutivos:', e);
    return res.status(500).json({ error: 'Error al listar ejecutivos' });
  }
});

// Listar ejecutivos (solo ejecutivos)
app.get('/api/admin/ejecutivos', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const ejecutivos = await Ejecutivo.find().sort({ nombre: 1 });

    // Contar clientes por ejecutivo
    const ejecutivosConContador = await Promise.all(
      ejecutivos.map(async (ej) => {
        const count = await User.countDocuments({ ejecutivoId: ej._id });
        return {
          id: ej._id,
          nombre: ej.nombre,
          email: ej.email,
          telefono: ej.telefono,
          activo: ej.activo,
          roles: {
            administrador: ej.roles?.administrador || false,
            pricing: ej.roles?.pricing || false,
            ejecutivo: ej.roles?.ejecutivo !== false,
            proveedor: ej.roles?.proveedor || false,
            operaciones: ej.roles?.operaciones || false,
          },
          clientesAsignados: count,
          createdAt: ej.createdAt
        };
      })
    );

    return res.json({
      success: true,
      ejecutivos: ejecutivosConContador
    });
  } catch (e) {
    console.error('[admin] Error listando ejecutivos:', e);
    return res.status(500).json({ error: 'Error al listar ejecutivos' });
  }
});

// Crear ejecutivo (solo ejecutivos)
app.post('/api/admin/ejecutivos', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const { nombre, email, telefono, roles } = (req.body as any) || {};
    if (!nombre || !email || !telefono) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Validar roles si se envían
    if (roles) {
      const { administrador, pricing, ejecutivo: rolEjecutivo, proveedor: rolProveedor, operaciones: rolOperaciones } = roles;
      if (administrador && (pricing || rolEjecutivo || rolProveedor || rolOperaciones)) {
        return res.status(400).json({ error: 'El rol Administrador no se puede combinar con otros roles' });
      }
      if (rolProveedor && (administrador || pricing || rolEjecutivo || rolOperaciones)) {
        return res.status(400).json({ error: 'El rol Proveedor no se puede combinar con otros roles' });
      }
      if (rolOperaciones && (administrador || pricing || rolEjecutivo || rolProveedor)) {
        return res.status(400).json({ error: 'El rol Operaciones no se puede combinar con otros roles' });
      }
      if (!administrador && !pricing && !rolEjecutivo && !rolProveedor && !rolOperaciones) {
        return res.status(400).json({ error: 'Debe tener al menos un rol asignado' });
      }
    }

    const nuevoEjecutivo = new Ejecutivo({
      nombre: String(nombre).trim(),
      email: String(email).toLowerCase().trim(),
      telefono: String(telefono).trim(),
      activo: true,
      ...(roles ? { roles } : {})
    });

    await nuevoEjecutivo.save();

    console.log('[admin] Ejecutivo creado:', nuevoEjecutivo.nombre);

    return res.json({
      success: true,
      message: 'Ejecutivo creado exitosamente',
      ejecutivo: {
        id: nuevoEjecutivo._id,
        nombre: nuevoEjecutivo.nombre,
        email: nuevoEjecutivo.email,
        telefono: nuevoEjecutivo.telefono,
        activo: nuevoEjecutivo.activo
      }
    });
  } catch (e) {
    console.error('[admin] Error creando ejecutivo:', e);
    return res.status(500).json({ error: 'Error al crear ejecutivo' });
  }
});

// Actualizar ejecutivo (solo ejecutivos)
app.put('/api/admin/ejecutivos/:id', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const { id } = req.params;
    const { nombre, email, telefono, activo, roles } = (req.body as any) || {};

    if (!nombre || !email || !telefono) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Validar roles si se envían
    if (roles) {
      const { administrador, pricing, ejecutivo: rolEjecutivo, proveedor: rolProveedor, operaciones: rolOperaciones } = roles;
      if (administrador && (pricing || rolEjecutivo || rolProveedor || rolOperaciones)) {
        return res.status(400).json({ error: 'El rol Administrador no se puede combinar con otros roles' });
      }
      if (rolProveedor && (administrador || pricing || rolEjecutivo || rolOperaciones)) {
        return res.status(400).json({ error: 'El rol Proveedor no se puede combinar con otros roles' });
      }
      if (rolOperaciones && (administrador || pricing || rolEjecutivo || rolProveedor)) {
        return res.status(400).json({ error: 'El rol Operaciones no se puede combinar con otros roles' });
      }
      if (!administrador && !pricing && !rolEjecutivo && !rolProveedor && !rolOperaciones) {
        return res.status(400).json({ error: 'Debe tener al menos un rol asignado' });
      }
    }

    const ejecutivo = await Ejecutivo.findByIdAndUpdate(
      id,
      {
        nombre: String(nombre).trim(),
        email: String(email).toLowerCase().trim(),
        telefono: String(telefono).trim(),
        activo: activo !== undefined ? activo : true,
        ...(roles ? { roles } : {}),
      },
      { new: true }
    );

    if (!ejecutivo) {
      return res.status(404).json({ error: 'Ejecutivo no encontrado' });
    }

    console.log('[admin] Ejecutivo actualizado:', ejecutivo.nombre);

    return res.json({
      success: true,
      message: 'Ejecutivo actualizado exitosamente',
      ejecutivo: {
        id: ejecutivo._id,
        nombre: ejecutivo.nombre,
        email: ejecutivo.email,
        telefono: ejecutivo.telefono,
        activo: ejecutivo.activo,
        roles: {
          administrador: ejecutivo.roles?.administrador || false,
          pricing: ejecutivo.roles?.pricing || false,
          ejecutivo: ejecutivo.roles?.ejecutivo !== false,
          proveedor: ejecutivo.roles?.proveedor || false,
          operaciones: ejecutivo.roles?.operaciones || false,
        }
      }
    });
  } catch (e) {
    console.error('[admin] Error actualizando ejecutivo:', e);
    return res.status(500).json({ error: 'Error al actualizar ejecutivo' });
  }
});

// Eliminar ejecutivo (solo ejecutivos)
app.delete('/api/admin/ejecutivos/:id', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const { id } = req.params;

    // Verificar si hay usuarios asignados
    const clientesAsignados = await User.countDocuments({ ejecutivoId: id });
    if (clientesAsignados > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar. Hay ${clientesAsignados} cliente(s) asignado(s) a este ejecutivo.` 
      });
    }

    await Ejecutivo.findByIdAndDelete(id);

    console.log('[admin] Ejecutivo eliminado:', id);

    return res.json({
      success: true,
      message: 'Ejecutivo eliminado exitosamente'
    });
  } catch (e) {
    console.error('[admin] Error eliminando ejecutivo:', e);
    return res.status(500).json({ error: 'Error al eliminar ejecutivo' });
  }
});

// ============================================================
// ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS
// ============================================================

// Crear nuevo usuario (solo para ejecutivos)
app.post('/api/admin/create-user', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos para crear usuarios' });
    }

    // ✅ MODIFICADO: Recibir ejecutivoId, nombreuser y usernames
    const { email, username, nombreuser, password, ejecutivoId, usernames } = (req.body as any) || {}; // ✅ AGREGADO usernames
    if (!email || !username || !nombreuser) { // ✅ AGREGADO nombreuser
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Use provided password (executive accounts) or server-side default for clients
    const DEFAULT_CLIENT_PASSWORD = process.env.DEFAULT_CLIENT_PASSWORD;
    const resolvedPassword = password ? String(password) : DEFAULT_CLIENT_PASSWORD;
    if (!resolvedPassword) {
      return res.status(500).json({ error: 'Contraseña por defecto no configurada en el servidor' });
    }
    const passwordHash = bcrypt.hashSync(resolvedPassword, 12);

    // Construir array de usernames
    const usernamesArray = Array.isArray(usernames) && usernames.length > 0
      ? usernames.map((u: string) => String(u).trim()).filter(Boolean)
      : [String(username).trim()];

    if (String(username).trim() !== 'Ejecutivo') {
      const duplicateCompanies = await findDuplicateCompanyNames(usernamesArray);
      if (duplicateCompanies.length > 0) {
        const duplicateLabel = duplicateCompanies[0];
        return res.status(400).json({
          error: `Ya existe una cuenta registrada con el nombre de empresa \"${duplicateLabel}\"`,
        });
      }
    }

    const newUser = new User({
      email: normalizedEmail,
      username: String(username).trim(),
      usernames: usernamesArray,
      nombreuser: String(nombreuser).trim(), // ✅ AGREGADO
      passwordHash,
      ejecutivoId: ejecutivoId || undefined
    });

    await newUser.save();

    console.log('[admin] Usuario creado:', normalizedEmail);

    // Notify ejecutivo: new client assigned (best-effort)
    if (ejecutivoId) {
      void emitClientAssignedNotification({
        ejecutivoObjectId: ejecutivoId,
        client: {
          _id: newUser._id as mongoose.Types.ObjectId,
          email: newUser.email,
          username: newUser.username,
          nombreuser: newUser.nombreuser,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        email: newUser.email,
        username: newUser.username
      }
    });
  } catch (e) {
    console.error('[admin] Error creando usuario:', e);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Listar usuarios (solo ejecutivos)
app.get('/api/admin/users', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos para ver usuarios' });
    }

    const users = await User.find({}, { passwordHash: 0 })
      .populate('ejecutivoId')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      users: users.map((u: any) => ({
        id: u._id,
        email: u.email,
        username: u.username,
        usernames: (u.usernames && u.usernames.length > 0) ? u.usernames : [u.username],
        nombreuser: u.nombreuser,
        createdAt: u.createdAt,
        ejecutivo: u.ejecutivoId ? {
          id: u.ejecutivoId._id,
          nombre: u.ejecutivoId.nombre,
          email: u.ejecutivoId.email,
          telefono: u.ejecutivoId.telefono
        } : null
      }))
    });
  } catch (e) {
    console.error('[admin] Error listando usuarios:', e);
    return res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// Actualizar usuario (solo ejecutivos)
app.put('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos para actualizar usuarios' });
    }

    const { id } = req.params;
    const { username, nombreuser, password, ejecutivoId, roles } = (req.body as any) || {};

    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (userToUpdate.username === 'Ejecutivo') {
      // Permitir editar ejecutivos: solo nombreuser y password
      if (nombreuser) {
        userToUpdate.nombreuser = String(nombreuser).trim();
      }
      if (password) {
        userToUpdate.passwordHash = bcrypt.hashSync(String(password), 12);
      }

      // Actualizar roles en el documento Ejecutivo vinculado
      if (roles) {
        const { administrador, pricing, ejecutivo: rolEjecutivo, proveedor: rolProveedor, operaciones: rolOperaciones } = roles;
        if (administrador && (pricing || rolEjecutivo || rolProveedor || rolOperaciones)) {
          return res.status(400).json({ error: 'El rol Administrador no se puede combinar con otros roles' });
        }
        if (rolProveedor && (administrador || pricing || rolEjecutivo || rolOperaciones)) {
          return res.status(400).json({ error: 'El rol Proveedor no se puede combinar con otros roles' });
        }
        if (rolOperaciones && (administrador || pricing || rolEjecutivo || rolProveedor)) {
          return res.status(400).json({ error: 'El rol Operaciones no se puede combinar con otros roles' });
        }
        if (!administrador && !pricing && !rolEjecutivo && !rolProveedor && !rolOperaciones) {
          return res.status(400).json({ error: 'Debe tener al menos un rol asignado' });
        }

        // Buscar ejecutivo por email o ejecutivoId
        let ejDoc = userToUpdate.ejecutivoId
          ? await Ejecutivo.findById(userToUpdate.ejecutivoId)
          : await Ejecutivo.findOne({ email: userToUpdate.email });

        if (ejDoc) {
          ejDoc.roles = roles;
          await ejDoc.save();
        }
      }

      // Actualizar teléfono en el documento Ejecutivo
      const { telefono } = (req.body as any) || {};
      if (telefono !== undefined) {
        let ejDocTel = userToUpdate.ejecutivoId
          ? await Ejecutivo.findById(userToUpdate.ejecutivoId)
          : await Ejecutivo.findOne({ email: userToUpdate.email });
        if (ejDocTel) {
          ejDocTel.telefono = String(telefono).trim();
          await ejDocTel.save();
        }
      }

      await userToUpdate.save();
      console.log('[admin] Ejecutivo actualizado:', userToUpdate.email);
      return res.json({
        success: true,
        message: 'Ejecutivo actualizado exitosamente',
        user: {
          id: userToUpdate._id,
          email: userToUpdate.email,
          username: userToUpdate.username
        }
      });
    }

    // Actualizar campos
    if (username) {
      userToUpdate.username = String(username).trim();
    }

    // ✅ AGREGADO: Actualizar usernames
    const { usernames: newUsernames } = (req.body as any) || {};
    if (Array.isArray(newUsernames)) {
      const cleanUsernames = newUsernames.map((u: string) => String(u).trim()).filter(Boolean);
      if (cleanUsernames.length > 0) {
        userToUpdate.usernames = cleanUsernames;
        // Sincronizar username con el primer elemento
        userToUpdate.username = cleanUsernames[0];
      }
    }

    // ✅ AGREGADO: Actualizar nombreuser
    if (nombreuser) {
      userToUpdate.nombreuser = String(nombreuser).trim();
    }

    if (password) {
      userToUpdate.passwordHash = bcrypt.hashSync(String(password), 12);
    }

    // Actualizar ejecutivoId (puede ser null para "sin asignar")
    if (ejecutivoId !== undefined) {
      userToUpdate.ejecutivoId = ejecutivoId ? ejecutivoId : undefined;
    }

    await userToUpdate.save();

    // Notify ejecutivo: client assigned (only when ejecutivoId is set and the user is a cliente).
    if (ejecutivoId && userToUpdate.username !== 'Ejecutivo') {
      void emitClientAssignedNotification({
        ejecutivoObjectId: ejecutivoId,
        client: {
          _id: userToUpdate._id as mongoose.Types.ObjectId,
          email: userToUpdate.email,
          username: userToUpdate.username,
          nombreuser: userToUpdate.nombreuser,
        },
      });
    }

    console.log('[admin] Usuario actualizado:', userToUpdate.email);

    return res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        id: userToUpdate._id,
        email: userToUpdate.email,
        username: userToUpdate.username
      }
    });
  } catch (e) {
    console.error('[admin] Error actualizando usuario:', e);
    return res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (solo ejecutivos)
app.delete('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No tienes permisos para eliminar usuarios' });
    }

    const { id } = req.params;

    const userToDelete = await User.findById(id);
    if (userToDelete?.username === 'Ejecutivo') {
      // Verificar que NO se elimine a sí mismo
      if (userToDelete.email === currentUser.sub) {
        return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
      }
      // Verificar si el ejecutivo tiene clientes asignados
      const ejDoc = userToDelete.ejecutivoId
        ? await Ejecutivo.findById(userToDelete.ejecutivoId)
        : await Ejecutivo.findOne({ email: userToDelete.email });
      if (ejDoc) {
        const clientesAsignados = await User.countDocuments({ ejecutivoId: ejDoc._id });
        if (clientesAsignados > 0) {
          return res.status(400).json({ 
            error: `No se puede eliminar. Hay ${clientesAsignados} cliente(s) asignado(s) a este ejecutivo.` 
          });
        }
        // Eliminar también el documento Ejecutivo
        await Ejecutivo.findByIdAndDelete(ejDoc._id);
      }
    }

    await User.findByIdAndDelete(id);

    console.log('[admin] Usuario eliminado:', id);

    return res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (e) {
    console.error('[admin] Error eliminando usuario:', e);
    return res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Modelo para guardar el token (en memoria para dev local)
interface LinbisTokenCache {
  refresh_token: string;
  access_token?: string;
  access_token_expiry?: number;
}

let linbisTokenCache: LinbisTokenCache = {
  refresh_token: process.env.LINBIS_REFRESH_TOKEN || '',
  access_token: undefined,
  access_token_expiry: undefined
};

// GET /api/linbis-token - Obtener token (con renovación automática)
app.get('/api/linbis-token', async (req, res) => {
  console.log('🔵 [linbis-token] Endpoint llamado');
  try {
    const LINBIS_CLIENT_ID = process.env.LINBIS_CLIENT_ID;
    const LINBIS_TOKEN_URL = process.env.LINBIS_TOKEN_URL;

    if (!LINBIS_CLIENT_ID || !LINBIS_TOKEN_URL) {
      return res.status(500).json({ 
        error: 'Missing Linbis configuration. Set LINBIS_CLIENT_ID and LINBIS_TOKEN_URL in .env' 
      });
    }

    if (!linbisTokenCache.refresh_token) {
      return res.status(500).json({ 
        error: 'No refresh token found. Please initialize it first with POST /api/admin/init-linbis-token' 
      });
    }

    const now = Date.now();
    if (linbisTokenCache.access_token && 
        linbisTokenCache.access_token_expiry && 
        linbisTokenCache.access_token_expiry > now + 300000) {
      console.log('[linbis-token] Using cached access token');
      return res.json({ token: linbisTokenCache.access_token });
    }

    console.log('[linbis-token] Refreshing access token...');

    const response = await fetch(LINBIS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: LINBIS_CLIENT_ID,
        refresh_token: linbisTokenCache.refresh_token,
        scope: 'https://linbis.onmicrosoft.com/linbis-api/access_as_user openid profile offline_access'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[linbis-token] Failed to refresh:', errorText);
      return res.status(500).json({ error: 'Failed to refresh Linbis token' });
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    linbisTokenCache.access_token = data.access_token;
    linbisTokenCache.access_token_expiry = now + (data.expires_in * 1000);

    if (data.refresh_token) {
      console.log('[linbis-token] Updating refresh token in cache');
      linbisTokenCache.refresh_token = data.refresh_token;
    }

    console.log('[linbis-token] Token refreshed successfully');
    return res.json({ token: linbisTokenCache.access_token });

  } catch (error) {
    console.error('[linbis-token] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/init-linbis-token - Inicializar token
app.post('/api/admin/init-linbis-token', (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    linbisTokenCache.refresh_token = refresh_token;
    linbisTokenCache.access_token = undefined;
    linbisTokenCache.access_token_expiry = undefined;

    console.log('[init-linbis-token] Refresh token initialized successfully');

    return res.json({ 
      success: true, 
      message: 'Refresh token initialized successfully' 
    });
  } catch (error) {
    console.error('[init-linbis-token] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** =========================
 *  ShipsGo API
 *  ========================= */

// GET /api/shipsgo/shipments - Obtener todos los shipments de ShipsGo (SIN autenticación)
app.get('/api/shipsgo/shipments', async (req, res) => {
  console.log('🚢 [shipsgo] Fetching shipments...');
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    const SHIPSGO_API_URL = 'https://api.shipsgo.com/v2/air/shipments';

    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ 
        error: 'Missing ShipsGo API token. Set SHIPSGO_API_TOKEN in .env' 
      });
    }

    // Hacer petición a ShipsGo API
    const response = await fetch(`${SHIPSGO_API_URL}?order_by=&skip=0&take=100`, {
      method: 'GET',
      headers: {
        'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo] API Error:', errorText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch shipments from ShipsGo' 
      });
    }

    const data = await response.json() as { shipments?: Array<any> };
    console.log(`[shipsgo] Successfully fetched ${data.shipments?.length || 0} shipments`);
    
    return res.json(data);

  } catch (error) {
    console.error('[shipsgo] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shipsgo/shipments - Crear un nuevo shipment
app.post('/api/shipsgo/shipments', auth, async (req, res) => {
  console.log('🚢 [shipsgo] Creating new shipment...');
  try {
    const currentUser = (req as any).user as AuthPayload;
    
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    const SHIPSGO_API_URL = 'https://api.shipsgo.com/v2/air/shipments';

    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ 
        error: 'Missing ShipsGo API token. Set SHIPSGO_API_TOKEN in environment variables' 
      });
    }

    // Obtener datos del body
    const { reference, awb_number, followers, tags } = req.body || {};

    // Validaciones básicas
    if (!reference || !awb_number) {
      return res.status(400).json({ 
        error: 'reference y awb_number son campos requeridos' 
      });
    }

    const canManageReference = await canManageShipsgoReference(
      currentUser,
      reference,
    );

    if (!canManageReference) {
      console.error(`[shipsgo] Security violation: User ${currentUser.username} tried to create shipment with reference ${reference}`);
      return res.status(403).json({ 
        error: 'No puedes crear trackeos para otros usuarios' 
      });
    }

    // Validar formato de AWB (11 dígitos, con o sin guion)
    const awbClean = awb_number.replace(/-/g, '');
    if (!/^\d{11}$/.test(awbClean)) {
      return res.status(400).json({ 
        error: 'El AWB debe contener exactamente 11 dígitos' 
      });
    }

    // Formatear AWB con guion (XXX-XXXXXXXX)
    const awbFormatted = `${awbClean.slice(0, 3)}-${awbClean.slice(3)}`;

    // Validar followers (opcional, pero si existe debe ser array)
    if (followers && !Array.isArray(followers)) {
      return res.status(400).json({ 
        error: 'followers debe ser un array de emails' 
      });
    }

    // Validar máximo 10 followers visibles + 1 correo interno de operaciones
    if (followers && followers.length > MAX_VISIBLE_TRACK_FOLLOWERS) {
      return res.status(400).json({ 
        error: 'Máximo 10 emails visibles permitidos en followers' 
      });
    }

    // Validar tags (opcional, pero si existe debe ser array)
    if (tags && !Array.isArray(tags)) {
      return res.status(400).json({ 
        error: 'tags debe ser un array' 
      });
    }

    // Validar máximo 10 tags
    if (tags && tags.length > 10) {
      return res.status(400).json({ 
        error: 'Máximo 10 tags permitidos' 
      });
    }

    // Preparar body para ShipsGo
    const shipmentData = {
      reference,
      awb_number: awbFormatted,
      followers: normalizeTrackingFollowers(followers),
      tags: tags || []
    };

    console.log('[shipsgo] Creating shipment:', shipmentData);

    // Hacer petición a ShipsGo API
    const response = await fetch(SHIPSGO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN
      },
      body: JSON.stringify(shipmentData)
    });

    const data = await response.json() as { shipment?: any };

    // Manejar respuestas específicas de ShipsGo
    if (response.status === 409) {
      // Shipment ya existe
      console.log('[shipsgo] Shipment already exists:', data);
      return res.status(409).json({ 
        error: 'Ya existe un trackeo con este AWB para tu cuenta',
        code: 'ALREADY_EXISTS',
        existingShipment: data.shipment || null
      });
    }

    if (response.status === 402) {
      // Sin créditos
      console.error('[shipsgo] Insufficient credits');
      return res.status(402).json({ 
        error: 'No hay créditos disponibles. Por favor contacta a tu ejecutivo de cuenta.',
        code: 'INSUFFICIENT_CREDITS'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo] API Error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Error al crear el shipment en ShipsGo',
        details: errorText
      });
    }

    console.log(`[shipsgo] Shipment created successfully:`, data.shipment);

    // Notify ejecutivo + cliente + operaciones (best-effort)
    if (data.shipment) {
      void emitTrackingNotification({
        type: 'TRACKING_CREATED',
        shipmentMode: 'AIR',
        shipmentId: String((data.shipment as any).id ?? ''),
        reference: String(reference),
        awbNumber: (data.shipment as any).awb_number,
        newStatus: (data.shipment as any).status,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Trackeo creado exitosamente',
      shipment: data.shipment
    });

  } catch (error: any) {
    console.error('[shipsgo] Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/shipsgo/shipments/:id - Eliminar un shipment aéreo
app.delete('/api/shipsgo/shipments/:id', auth, async (req, res) => {
  const { id } = req.params;
  console.log(`✈️ [shipsgo] Deleting air shipment id=${id}...`);

  try {
    const currentUser = (req as any).user as AuthPayload;
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;

    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const permission = await canDeleteShipsgoShipment(
      currentUser,
      'air',
      id,
      SHIPSGO_API_TOKEN,
    );

    if (!permission.allowed) {
      return res.status(permission.status).json({
        error: permission.error || 'No tienes permisos para eliminar este tracking',
      });
    }

    const response = await fetch(
      `https://api.shipsgo.com/v2/air/shipments/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN,
        },
      },
    );

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          (data as any).error ||
          (data as any).message ||
          'No se pudo eliminar el tracking',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tracking eliminado correctamente',
    });
  } catch (error) {
    console.error('[shipsgo] Delete air shipment error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/shipsgo/shipments/:id/followers - Agregar follower a shipment aéreo existente
app.post('/api/shipsgo/shipments/:id/followers', auth, async (req, res) => {
  const { id } = req.params;
  console.log(`✈️ [shipsgo] Adding follower to air shipment id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    if (!/^\d+$/.test(String(id || ''))) {
      return res.status(400).json({ error: 'shipment_id inválido' });
    }

    const follower = String(req.body?.follower || '').trim();
    if (!follower) {
      return res.status(400).json({ error: 'follower es un campo requerido' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(follower)) {
      return res.status(400).json({ error: 'Debes ingresar un correo electrónico válido' });
    }

    if (follower.toLowerCase() === OPERATIONS_FOLLOWER_EMAIL) {
      return res.status(400).json({
        error: 'El correo de operaciones se agrega automáticamente en todos los trackings',
      });
    }

    const response = await fetch(
      `https://api.shipsgo.com/v2/air/shipments/${encodeURIComponent(id)}/followers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN,
        },
        body: JSON.stringify({ follower }),
      },
    );

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (response.status === 409) {
      return res.status(409).json({ error: 'Ese correo ya está agregado a este tracking' });
    }

    if (response.status === 403) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este tracking' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: (data as any).error || (data as any).message || 'No se pudo agregar el correo al tracking',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Correo agregado correctamente',
      follower: (data as any).follower || null,
    });
  } catch (error) {
    console.error('[shipsgo] Add follower error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/shipsgo/shipments/:id/followers/:followerId - Eliminar follower de shipment aéreo existente
app.delete('/api/shipsgo/shipments/:id/followers/:followerId', auth, async (req, res) => {
  const { id, followerId } = req.params;
  console.log(`✈️ [shipsgo] Removing follower ${followerId} from air shipment id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    if (!/^\d+$/.test(String(id || '')) || !/^\d+$/.test(String(followerId || ''))) {
      return res.status(400).json({ error: 'shipment_id o follower_id inválido' });
    }

    const followerEmail = await getShipsgoShipmentFollowerEmail('air', id, followerId, SHIPSGO_API_TOKEN);
    if (followerEmail === OPERATIONS_FOLLOWER_EMAIL) {
      return res.status(400).json({
        error: 'El correo de operaciones es obligatorio y no puede eliminarse',
      });
    }

    const response = await fetch(
      `https://api.shipsgo.com/v2/air/shipments/${encodeURIComponent(id)}/followers/${encodeURIComponent(followerId)}`,
      {
        method: 'DELETE',
        headers: {
          'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN,
        },
      },
    );

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (response.status === 403) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este tracking' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: (data as any).error || (data as any).message || 'No se pudo eliminar el correo del tracking',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Correo eliminado correctamente',
    });
  } catch (error) {
    console.error('[shipsgo] Remove follower error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/shipsgo/shipments/:id - Obtener detalles de un shipment aéreo
app.get('/api/shipsgo/shipments/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`✈️ [shipsgo] Fetching air shipment detail for id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const response = await fetch(`https://api.shipsgo.com/v2/air/shipments/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo] Detail API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch shipment detail' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('[shipsgo] Detail Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shipsgo/shipments/:id/geojson - Obtener ruta GeoJSON de un shipment aéreo (experimental)
app.get('/api/shipsgo/shipments/:id/geojson', async (req, res) => {
  const { id } = req.params;
  console.log(`✈️ [shipsgo] Fetching air shipment geojson for id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const response = await fetch(`https://api.shipsgo.com/v2/air/shipments/${encodeURIComponent(id)}/geojson`, {
      method: 'GET',
      headers: { 'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo] GeoJSON API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch shipment route' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('[shipsgo] GeoJSON Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shipsgo/webhooks/air - Webhook endpoint para eventos de ShipsGo Air
app.post('/api/shipsgo/webhooks/air', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('🔔 [shipsgo-webhook] Received air webhook event');
  try {
    const SHIPSGO_WEBHOOK_SECRET = process.env.SHIPSGO_WEBHOOK_SECRET;
    const signature = req.headers['x-shipsgo-webhook-signature'] as string | undefined;
    const webhookId = req.headers['x-shipsgo-webhook-id'] as string | undefined;
    const webhookName = req.headers['x-shipsgo-webhook-name'] as string | undefined;

    // Validate signature if secret is configured
    if (SHIPSGO_WEBHOOK_SECRET && signature) {
      const crypto = await import('crypto');
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', SHIPSGO_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('[shipsgo-webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = payload?.event?.name || 'UNKNOWN';
    const shipmentId = payload?.shipment?.id;

    console.log(`[shipsgo-webhook] Event: ${eventName}, Webhook-Id: ${webhookId}, Webhook-Name: ${webhookName}, Shipment: ${shipmentId}`);
    console.log('[shipsgo-webhook] Payload:', JSON.stringify(payload, null, 2));

    // Respond immediately with 200 to acknowledge receipt
    res.status(200).json({ received: true, event: eventName });
  } catch (error) {
    console.error('[shipsgo-webhook] Error processing webhook:', error);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

/** =========================
 *  ShipsGo Ocean API (Marítimo)
 *  ========================= */

// GET /api/shipsgo/ocean/carriers - Obtener lista de carriers marítimos
app.get('/api/shipsgo/ocean/carriers', async (req, res) => {
  console.log('🚢 [shipsgo-ocean] Fetching carriers...');
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const response = await fetch('https://api.shipsgo.com/v2/ocean/carriers', {
      method: 'GET',
      headers: { 'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo-ocean] Carriers API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch ocean carriers' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('[shipsgo-ocean] Carriers Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shipsgo/ocean/shipments - Obtener todos los shipments marítimos
app.get('/api/shipsgo/ocean/shipments', async (req, res) => {
  console.log('🚢 [shipsgo-ocean] Fetching ocean shipments...');
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    const SHIPSGO_OCEAN_URL = 'https://api.shipsgo.com/v2/ocean/shipments';

    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const response = await fetch(`${SHIPSGO_OCEAN_URL}?order_by=created_at,desc&skip=0&take=100`, {
      method: 'GET',
      headers: { 'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo-ocean] API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch ocean shipments' });
    }

    const data = await response.json() as { shipments?: Array<any> };
    console.log(`[shipsgo-ocean] Successfully fetched ${data.shipments?.length || 0} ocean shipments`);
    return res.json(data);
  } catch (error) {
    console.error('[shipsgo-ocean] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shipsgo/ocean/shipments - Crear un nuevo shipment marítimo
app.post('/api/shipsgo/ocean/shipments', auth, async (req, res) => {
  console.log('🚢 [shipsgo-ocean] Creating new ocean shipment...');
  try {
    const currentUser = (req as any).user as AuthPayload;

    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    const SHIPSGO_OCEAN_URL = 'https://api.shipsgo.com/v2/ocean/shipments';

    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const { reference, container_number, booking_number, carrier, followers, tags } = req.body || {};

    // Validar referencia
    if (!reference) {
      return res.status(400).json({ error: 'reference es un campo requerido' });
    }

    const canManageReference = await canManageShipsgoReference(
      currentUser,
      reference,
    );

    if (!canManageReference) {
      console.error(`[shipsgo-ocean] Security violation: User ${currentUser.username} tried to create shipment with reference ${reference}`);
      return res.status(403).json({ error: 'No puedes crear trackeos para otros usuarios' });
    }

    // Validar que al menos container_number o booking_number esté presente
    if (!container_number && !booking_number) {
      return res.status(400).json({ error: 'Debes proporcionar container_number o booking_number' });
    }

    // Validar formato de container_number si se proporcionó
    if (container_number && !/^[A-Z]{4}[0-9]{7}$/.test(container_number)) {
      return res.status(400).json({ error: 'El container number debe tener formato XXXX0000000 (4 letras + 7 dígitos)' });
    }

    // Validar formato de booking_number si se proporcionó
    if (booking_number && !/^[a-zA-Z0-9/\-]+$/.test(booking_number)) {
      return res.status(400).json({ error: 'El booking number solo puede contener letras, números, / y -' });
    }

    // Validar carrier si se proporcionó
    if (carrier && !/^(SG_)?[A-Z0-9]{4}$/.test(carrier)) {
      return res.status(400).json({ error: 'El código de carrier (SCAC) no tiene un formato válido' });
    }

    // Validar followers
    if (followers && !Array.isArray(followers)) {
      return res.status(400).json({ error: 'followers debe ser un array de emails' });
    }
    if (followers && followers.length > MAX_VISIBLE_TRACK_FOLLOWERS) {
      return res.status(400).json({ error: 'Máximo 10 emails visibles permitidos en followers' });
    }

    // Validar tags
    if (tags && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags debe ser un array' });
    }
    if (tags && tags.length > 10) {
      return res.status(400).json({ error: 'Máximo 10 tags permitidos' });
    }

    // Preparar body para ShipsGo
    const shipmentData: Record<string, any> = {
      reference,
      followers: normalizeTrackingFollowers(followers),
      tags: tags || []
    };
    if (container_number) shipmentData.container_number = container_number;
    if (booking_number) shipmentData.booking_number = booking_number;
    if (carrier) shipmentData.carrier = carrier;

    console.log('[shipsgo-ocean] Creating ocean shipment:', shipmentData);

    const response = await fetch(SHIPSGO_OCEAN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN
      },
      body: JSON.stringify(shipmentData)
    });

    const data = await response.json() as { shipment?: any; [key: string]: any };

    if (response.status === 409) {
      console.log('[shipsgo-ocean] Shipment already exists:', data);
      return res.status(409).json({
        error: 'Ya existe un trackeo con estos datos para tu cuenta',
        code: 'ALREADY_EXISTS',
        existingShipment: data.shipment || null
      });
    }

    if (response.status === 402) {
      console.error('[shipsgo-ocean] Insufficient credits');
      return res.status(402).json({
        error: 'No hay créditos disponibles. Por favor contacta a tu ejecutivo de cuenta.',
        code: 'INSUFFICIENT_CREDITS'
      });
    }

    if (!response.ok) {
      const errorText = JSON.stringify(data);
      console.error('[shipsgo-ocean] API Error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Error al crear el shipment marítimo en ShipsGo',
        details: errorText
      });
    }

    console.log(`[shipsgo-ocean] Ocean shipment created successfully:`, data.shipment);

    // Notify ejecutivo + cliente + operaciones (best-effort)
    if (data.shipment) {
      void emitTrackingNotification({
        type: 'TRACKING_CREATED',
        shipmentMode: 'OCEAN',
        shipmentId: String((data.shipment as any).id ?? ''),
        reference: String(reference),
        containerNumber: (data.shipment as any).container_number || container_number,
        newStatus: (data.shipment as any).status,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Trackeo marítimo creado exitosamente',
      shipment: data.shipment
    });

  } catch (error: any) {
    console.error('[shipsgo-ocean] Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/shipsgo/ocean/shipments/:id - Eliminar un shipment marítimo
app.delete('/api/shipsgo/ocean/shipments/:id', auth, async (req, res) => {
  const { id } = req.params;
  console.log(`🚢 [shipsgo-ocean] Deleting ocean shipment id=${id}...`);

  try {
    const currentUser = (req as any).user as AuthPayload;
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;

    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const permission = await canDeleteShipsgoShipment(
      currentUser,
      'ocean',
      id,
      SHIPSGO_API_TOKEN,
    );

    if (!permission.allowed) {
      return res.status(permission.status).json({
        error: permission.error || 'No tienes permisos para eliminar este tracking',
      });
    }

    const response = await fetch(
      `https://api.shipsgo.com/v2/ocean/shipments/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN,
        },
      },
    );

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          (data as any).error ||
          (data as any).message ||
          'No se pudo eliminar el tracking',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tracking eliminado correctamente',
    });
  } catch (error) {
    console.error('[shipsgo-ocean] Delete ocean shipment error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/shipsgo/ocean/shipments/:id/followers - Agregar follower a shipment marítimo existente
app.post('/api/shipsgo/ocean/shipments/:id/followers', auth, async (req, res) => {
  const { id } = req.params;
  console.log(`🚢 [shipsgo-ocean] Adding follower to ocean shipment id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    if (!/^\d+$/.test(String(id || ''))) {
      return res.status(400).json({ error: 'shipment_id inválido' });
    }

    const follower = String(req.body?.follower || '').trim();
    if (!follower) {
      return res.status(400).json({ error: 'follower es un campo requerido' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(follower)) {
      return res.status(400).json({ error: 'Debes ingresar un correo electrónico válido' });
    }

    if (follower.toLowerCase() === OPERATIONS_FOLLOWER_EMAIL) {
      return res.status(400).json({
        error: 'El correo de operaciones se agrega automáticamente en todos los trackings',
      });
    }

    const response = await fetch(
      `https://api.shipsgo.com/v2/ocean/shipments/${encodeURIComponent(id)}/followers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN,
        },
        body: JSON.stringify({ follower }),
      },
    );

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (response.status === 409) {
      return res.status(409).json({ error: 'Ese correo ya está agregado a este tracking' });
    }

    if (response.status === 403) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este tracking' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: (data as any).error || (data as any).message || 'No se pudo agregar el correo al tracking',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Correo agregado correctamente',
      follower: (data as any).follower || null,
    });
  } catch (error) {
    console.error('[shipsgo-ocean] Add follower error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/shipsgo/ocean/shipments/:id/followers/:followerId - Eliminar follower de shipment marítimo existente
app.delete('/api/shipsgo/ocean/shipments/:id/followers/:followerId', auth, async (req, res) => {
  const { id, followerId } = req.params;
  console.log(`🚢 [shipsgo-ocean] Removing follower ${followerId} from ocean shipment id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    if (!/^\d+$/.test(String(id || '')) || !/^\d+$/.test(String(followerId || ''))) {
      return res.status(400).json({ error: 'shipment_id o follower_id inválido' });
    }

    const followerEmail = await getShipsgoShipmentFollowerEmail('ocean', id, followerId, SHIPSGO_API_TOKEN);
    if (followerEmail === OPERATIONS_FOLLOWER_EMAIL) {
      return res.status(400).json({
        error: 'El correo de operaciones es obligatorio y no puede eliminarse',
      });
    }

    const response = await fetch(
      `https://api.shipsgo.com/v2/ocean/shipments/${encodeURIComponent(id)}/followers/${encodeURIComponent(followerId)}`,
      {
        method: 'DELETE',
        headers: {
          'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN,
        },
      },
    );

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (response.status === 403) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este tracking' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: (data as any).error || (data as any).message || 'No se pudo eliminar el correo del tracking',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Correo eliminado correctamente',
    });
  } catch (error) {
    console.error('[shipsgo-ocean] Remove follower error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/shipsgo/ocean/shipments/:id - Obtener detalles de un shipment marítimo
app.get('/api/shipsgo/ocean/shipments/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`🚢 [shipsgo-ocean] Fetching ocean shipment detail for id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const response = await fetch(`https://api.shipsgo.com/v2/ocean/shipments/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo-ocean] Detail API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch ocean shipment detail' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('[shipsgo-ocean] Detail Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shipsgo/ocean/shipments/:id/geojson - Obtener ruta GeoJSON de un shipment marítimo (experimental)
app.get('/api/shipsgo/ocean/shipments/:id/geojson', async (req, res) => {
  const { id } = req.params;
  console.log(`🚢 [shipsgo-ocean] Fetching ocean shipment geojson for id=${id}...`);
  try {
    const SHIPSGO_API_TOKEN = process.env.SHIPSGO_API_TOKEN;
    if (!SHIPSGO_API_TOKEN) {
      return res.status(500).json({ error: 'Missing ShipsGo API token' });
    }

    const response = await fetch(`https://api.shipsgo.com/v2/ocean/shipments/${encodeURIComponent(id)}/geojson`, {
      method: 'GET',
      headers: { 'X-Shipsgo-User-Token': SHIPSGO_API_TOKEN },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[shipsgo-ocean] GeoJSON API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch ocean shipment route' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('[shipsgo-ocean] GeoJSON Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shipsgo/webhooks/ocean - Webhook endpoint para eventos de ShipsGo Ocean
app.post('/api/shipsgo/webhooks/ocean', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('🔔 [shipsgo-webhook] Received ocean webhook event');
  try {
    const SHIPSGO_WEBHOOK_SECRET = process.env.SHIPSGO_WEBHOOK_SECRET;
    const signature = req.headers['x-shipsgo-webhook-signature'] as string | undefined;
    const webhookId = req.headers['x-shipsgo-webhook-id'] as string | undefined;
    const webhookName = req.headers['x-shipsgo-webhook-name'] as string | undefined;

    // Validate signature if secret is configured
    if (SHIPSGO_WEBHOOK_SECRET && signature) {
      const crypto = await import('crypto');
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', SHIPSGO_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('[shipsgo-webhook] Invalid ocean webhook signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = payload?.event?.name || 'UNKNOWN';
    const shipmentId = payload?.shipment?.id;

    console.log(`[shipsgo-webhook] Ocean Event: ${eventName}, Webhook-Id: ${webhookId}, Webhook-Name: ${webhookName}, Shipment: ${shipmentId}`);
    console.log('[shipsgo-webhook] Ocean Payload:', JSON.stringify(payload, null, 2));

    // Respond immediately with 200 to acknowledge receipt
    res.status(200).json({ received: true, event: eventName });
  } catch (error) {
    console.error('[shipsgo-webhook] Error processing ocean webhook:', error);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

// ============================================================
// RUTAS DE DOCUMENTOS
// ============================================================

// GET /api/documents/all?ownerUsername=X - Todos los docs de un usuario (sin base64)
app.get('/api/documents/all', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser) return res.status(401).json({ error: 'No autorizado' });

    const ownerUsername = (req.query?.ownerUsername as string) || currentUser.username;
    if (!ownerUsername) return res.status(400).json({ error: 'ownerUsername requerido' });

    const [airDocs, oceanDocs, groundDocs, quoteDocs] = await Promise.all([
      AirShipmentDocumento.find({ usuarioId: ownerUsername }).select('-contenidoBase64').sort({ createdAt: -1 }),
      OceanShipmentDocumento.find({ usuarioId: ownerUsername }).select('-contenidoBase64').sort({ createdAt: -1 }),
      GroundShipmentDocumento.find({ usuarioId: ownerUsername }).select('-contenidoBase64').sort({ createdAt: -1 }),
      Documento.find({ usuarioId: ownerUsername }).select('-contenidoBase64').sort({ createdAt: -1 }),
    ]);

    const mapDoc = (doc: any) => ({
      id: doc._id.toString(),
      shipmentId: doc.shipmentId || doc.quoteId || null,
      tipo: doc.tipo,
      nombreArchivo: doc.nombreArchivo,
      tipoArchivo: doc.tipoArchivo,
      tamanoMB: (doc.tamanoBytes / (1024 * 1024)).toFixed(2),
      fechaSubida: doc.createdAt,
    });

    return res.status(200).json({
      air: airDocs.map(mapDoc),
      ocean: oceanDocs.map(mapDoc),
      ground: groundDocs.map(mapDoc),
      quotes: quoteDocs.map(mapDoc),
    });
  } catch (error) {
    console.error('[documents/all] Error:', error);
    return res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// POST /api/documentos/upload - Subir documento
app.post('/api/documentos/upload', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    
    if (!currentUser || !currentUser.sub || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { quoteId, tipo, nombreArchivo, contenidoBase64 } = req.body;

    if (!quoteId || !tipo || !nombreArchivo || !contenidoBase64) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: quoteId, tipo, nombreArchivo, contenidoBase64' 
      });
    }

    const tiposPermitidos = ['Orden de compra', 'Invoice', 'Packing List', 'Certificado de Origen', 'Póliza de seguro', 'Guía de Despacho', 'Declaración de Ingreso'];
    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ 
        error: `Tipo de documento inválido. Debe ser uno de: ${tiposPermitidos.join(', ')}` 
      });
    }

    if (!validateBase64(contenidoBase64)) {
      return res.status(400).json({ 
        error: 'El archivo debe estar en formato base64 válido' 
      });
    }

    const mimeType = getMimeTypeFromBase64(contenidoBase64);
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ 
        error: 'Tipo de archivo no permitido. Solo PDF, Excel y Word' 
      });
    }

    const fileSize = getBase64Size(contenidoBase64);
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `El archivo excede el tamaño máximo de 5MB. Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB` 
      });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    // Upload to R2 instead of storing base64 in MongoDB
    const base64Content = contenidoBase64.includes('base64,')
      ? contenidoBase64.split('base64,')[1]
      : contenidoBase64;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const docId = new mongoose.Types.ObjectId();
    const r2Key = buildDocR2Key('documentos', ownerUsername, String(quoteId), docId.toString(), String(nombreArchivo));

    await uploadDocument(r2Key, fileBuffer, mimeType);

    const nuevoDocumento = await Documento.create({
      _id: docId,
      quoteId: String(quoteId),
      tipo,
      nombreArchivo: String(nombreArchivo),
      tipoArchivo: mimeType,
      tamanoBytes: fileSize,
      r2Key,
      subidoPor: currentUser.sub,
      usuarioId: ownerUsername
    });

    console.log(`[documentos] Documento subido: ${nuevoDocumento._id}`);

    // Fire-and-forget: notificar por email
    sendDocumentUploadNotification({
      uploaderEmail: currentUser.sub,
      ownerUsername,
      numero: String(quoteId),
      tipoOperacion: 'Cotización',
      tipoDocumento: tipo,
      nombreArchivo: String(nombreArchivo),
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Documento subido exitosamente',
      documento: {
        id: nuevoDocumento._id,
        quoteId: nuevoDocumento.quoteId,
        tipo: nuevoDocumento.tipo,
        nombreArchivo: nuevoDocumento.nombreArchivo,
        tipoArchivo: nuevoDocumento.tipoArchivo,
        tamanoMB: (nuevoDocumento.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: nuevoDocumento.createdAt
      }
    });

  } catch (error: any) {
    console.error('[documentos] Error al subir:', error);
    return res.status(500).json({ 
      error: 'Error interno al subir documento',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/documentos/:quoteId - Obtener documentos de una cotización
app.get('/api/documentos/:quoteId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    
    if (!currentUser || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { quoteId } = req.params;

    if (!quoteId) {
      return res.status(400).json({ error: 'quoteId es requerido' });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documentos = await Documento.find({ 
      quoteId: String(quoteId),
      ...buildDocumentOwnerScopeQuery(ownerUsername)
    })
    .select('-contenidoBase64')
    .sort({ createdAt: -1 });

    console.log(`[documentos] Encontrados ${documentos.length} documentos para quote ${quoteId}`);

    return res.json({
      success: true,
      documentos: documentos.map(doc => ({
        id: doc._id,
        quoteId: doc.quoteId,
        tipo: doc.tipo,
        nombreArchivo: doc.nombreArchivo,
        tipoArchivo: doc.tipoArchivo,
        tamanoMB: (doc.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: doc.createdAt
      }))
    });

  } catch (error: any) {
    console.error('[documentos] Error al obtener:', error);
    return res.status(500).json({ 
      error: 'Error interno al obtener documentos'
    });
  }
});

// GET /api/documentos/download/:documentoId - Descargar documento
app.get('/api/documentos/download/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    
    if (!currentUser || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { documentoId } = req.params;

    if (!documentoId) {
      return res.status(400).json({ error: 'documentoId es requerido' });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await Documento.findById(documentoId);

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para descargar este documento' });
    }

    console.log(`[documentos] Descargando: ${documento._id}`);

    // R2 path: proxy binary
    if (documento.r2Key) {
      try {
        const docBuffer = await downloadDocumentBuffer(documento.r2Key);
        res.setHeader('Content-Type', documento.tipoArchivo || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documento.nombreArchivo)}"`);
        res.setHeader('Content-Length', docBuffer.length.toString());
        return res.end(docBuffer);
      } catch (r2Err: any) {
        console.error('[documentos] Error al descargar de R2:', r2Err);
        return res.status(500).json({ error: 'Error al descargar documento de almacenamiento' });
      }
    }

    // Legacy path: base64 from MongoDB
    return res.json({
      success: true,
      documento: {
        id: documento._id,
        quoteId: documento.quoteId,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoMB: (documento.tamanoBytes / 1024 / 1024).toFixed(2),
        contenidoBase64: documento.contenidoBase64,
        fechaSubida: documento.createdAt
      }
    });

  } catch (error: any) {
    console.error('[documentos] Error al descargar:', error);
    return res.status(500).json({ 
      error: 'Error interno al descargar documento'
    });
  }
});

// DELETE /api/documentos/:documentoId - Eliminar documento
app.delete('/api/documentos/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    
    if (!currentUser || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { documentoId } = req.params;

    if (!documentoId) {
      return res.status(400).json({ error: 'documentoId es requerido' });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await Documento.findById(documentoId);

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este documento' });
    }

    // Delete from R2 if stored there
    if (documento.r2Key) {
      try {
        await deleteDocument(documento.r2Key);
      } catch (r2Err) {
        console.error('[documentos] Error al eliminar de R2:', r2Err);
      }
    }

    await Documento.findByIdAndDelete(documentoId);

    console.log(`[documentos] Eliminado: ${documentoId}`);

    return res.json({
      success: true,
      message: 'Documento eliminado exitosamente'
    });

  } catch (error: any) {
    console.error('[documentos] Error al eliminar:', error);
    return res.status(500).json({ 
      error: 'Error interno al eliminar documento'
    });
  }
});

console.log('📄 Rutas de documentos configuradas');

app.post('/api/air-shipments/documentos/upload', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user; // ajuste a su implementación real
    if (!currentUser?.username || !currentUser?.sub) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { shipmentId, tipo, nombreArchivo, contenidoBase64 } = req.body;

    if (!shipmentId || !tipo || !nombreArchivo || !contenidoBase64) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: shipmentId, tipo, nombreArchivo, contenidoBase64',
      });
    }

    const tiposPermitidos = [
      'Documento de transporte Internacional (AWB)',
      'Facturas asociados al servicio',
      'Invoice',
      'Packing List',
      'Certificado de Origen',
      'Póliza de Seguro',
      'Declaración de ingreso (DNI)',
      'Guía de despacho',
      'SDA',
      'Papeleta',
      'Transporte local',
      'Otros Documentos',
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo de documento inválido. Debe ser uno de: ${tiposPermitidos.join(', ')}`,
      });
    }

    if (!validateBase64(contenidoBase64)) {
      return res.status(400).json({ error: 'El archivo debe estar en formato base64 válido' });
    }

    const mimeType = getMimeTypeFromBase64(contenidoBase64);
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF, Excel y Word' });
    }

    const fileSize = getBase64Size(contenidoBase64);
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `El archivo excede el tamaño máximo de 5MB. Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    // Upload to R2 instead of storing base64 in MongoDB
    const base64Content = contenidoBase64.includes('base64,')
      ? contenidoBase64.split('base64,')[1]
      : contenidoBase64;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const docId = new mongoose.Types.ObjectId();
    const r2Key = buildDocR2Key('air', ownerUsername, String(shipmentId), docId.toString(), String(nombreArchivo));

    await uploadDocument(r2Key, fileBuffer, mimeType);

    const nuevoDocumento = await AirShipmentDocumento.create({
      _id: docId,
      shipmentId: String(shipmentId),
      tipo,
      nombreArchivo: String(nombreArchivo),
      tipoArchivo: mimeType,
      tamanoBytes: fileSize,
      r2Key,
      subidoPor: currentUser.sub,
      usuarioId: ownerUsername,
    });

    // Fire-and-forget: notificar por email
    sendDocumentUploadNotification({
      uploaderEmail: currentUser.sub,
      ownerUsername,
      numero: String(shipmentId),
      tipoOperacion: 'Operación Aérea',
      tipoDocumento: tipo,
      nombreArchivo: String(nombreArchivo),
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      documento: {
        id: nuevoDocumento._id,
        shipmentId: nuevoDocumento.shipmentId,
        tipo: nuevoDocumento.tipo,
        nombreArchivo: nuevoDocumento.nombreArchivo,
        tipoArchivo: nuevoDocumento.tipoArchivo,
        tamanoMB: (nuevoDocumento.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: nuevoDocumento.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al subir documento' });
  }
});

app.get('/api/air-shipments/documentos/:shipmentId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { shipmentId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documentos = await AirShipmentDocumento.find({
      shipmentId: String(shipmentId),
      ...buildDocumentOwnerScopeQuery(ownerUsername),
    })
      .select('-contenidoBase64')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      documentos: documentos.map((doc) => ({
        id: doc._id,
        shipmentId: doc.shipmentId,
        tipo: doc.tipo,
        nombreArchivo: doc.nombreArchivo,
        tipoArchivo: doc.tipoArchivo,
        tamanoMB: (doc.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: doc.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al obtener documentos' });
  }
});

app.get('/api/air-shipments/documentos/download/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { documentoId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await AirShipmentDocumento.findById(documentoId);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para descargar este documento' });
    }

    // R2 path: proxy binary
    if (documento.r2Key) {
      try {
        const docBuffer = await downloadDocumentBuffer(documento.r2Key);
        res.setHeader('Content-Type', documento.tipoArchivo || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documento.nombreArchivo)}"`);
        res.setHeader('Content-Length', docBuffer.length.toString());
        return res.end(docBuffer);
      } catch (r2Err: any) {
        console.error('[air-documentos] Error al descargar de R2:', r2Err);
        return res.status(500).json({ error: 'Error al descargar documento de almacenamiento' });
      }
    }

    // Legacy path: base64 from MongoDB
    return res.json({
      success: true,
      documento: {
        id: documento._id,
        shipmentId: documento.shipmentId,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoMB: (documento.tamanoBytes / 1024 / 1024).toFixed(2),
        contenidoBase64: documento.contenidoBase64,
        fechaSubida: documento.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al descargar documento' });
  }
});

app.delete('/api/air-shipments/documentos/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { documentoId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await AirShipmentDocumento.findById(documentoId);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este documento' });
    }

    // Delete from R2 if stored there
    if (documento.r2Key) {
      try {
        await deleteDocument(documento.r2Key);
      } catch (r2Err) {
        console.error('[air-documentos] Error al eliminar de R2:', r2Err);
      }
    }

    await AirShipmentDocumento.findByIdAndDelete(documentoId);
    return res.json({ success: true, message: 'Documento eliminado exitosamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al eliminar documento' });
  }
});

// ============================================================
// RUTAS DE DOCUMENTOS (OCEAN SHIPMENTS)
// ============================================================

app.post('/api/ocean-shipments/documentos/upload', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username || !currentUser?.sub) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { shipmentId, tipo, nombreArchivo, contenidoBase64 } = req.body;

    if (!shipmentId || !tipo || !nombreArchivo || !contenidoBase64) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: shipmentId, tipo, nombreArchivo, contenidoBase64',
      });
    }

    const tiposPermitidos = [
      'Bill of Lading (BL)',
      'Facturas asociadas al servicio',
      'Endoso',
      'Invoice',
      'Packing List',
      'Certificado de Origen',
      'Póliza de Seguro',
      'Declaración de ingreso (DIN)',
      'Guía de despacho / Delivery Order',
      'SDA',
      'Papeleta',
      'Transporte local',
      'Warehouse Receipt',
      "Mate's Receipt / Received for shipment",
      'Otros Documentos',
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo de documento inválido. Debe ser uno de: ${tiposPermitidos.join(', ')}`,
      });
    }

    if (!validateBase64(contenidoBase64)) {
      return res.status(400).json({ error: 'El archivo debe estar en formato base64 válido' });
    }

    const mimeType = getMimeTypeFromBase64(contenidoBase64);
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF, Excel y Word' });
    }

    const fileSize = getBase64Size(contenidoBase64);
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `El archivo excede el tamaño máximo de 5MB. Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    // Upload to R2 instead of storing base64 in MongoDB
    const base64Content = contenidoBase64.includes('base64,')
      ? contenidoBase64.split('base64,')[1]
      : contenidoBase64;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const docId = new mongoose.Types.ObjectId();
    const r2Key = buildDocR2Key('ocean', ownerUsername, String(shipmentId), docId.toString(), String(nombreArchivo));

    await uploadDocument(r2Key, fileBuffer, mimeType);

    const nuevoDocumento = await OceanShipmentDocumento.create({
      _id: docId,
      shipmentId: String(shipmentId),
      tipo,
      nombreArchivo: String(nombreArchivo),
      tipoArchivo: mimeType,
      tamanoBytes: fileSize,
      r2Key,
      subidoPor: currentUser.sub,
      usuarioId: ownerUsername,
    });

    // Fire-and-forget: notificar por email
    sendDocumentUploadNotification({
      uploaderEmail: currentUser.sub,
      ownerUsername,
      numero: String(shipmentId),
      tipoOperacion: 'Operación Marítima',
      tipoDocumento: tipo,
      nombreArchivo: String(nombreArchivo),
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      documento: {
        id: nuevoDocumento._id,
        shipmentId: nuevoDocumento.shipmentId,
        tipo: nuevoDocumento.tipo,
        nombreArchivo: nuevoDocumento.nombreArchivo,
        tipoArchivo: nuevoDocumento.tipoArchivo,
        tamanoMB: (nuevoDocumento.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: nuevoDocumento.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al subir documento' });
  }
});

app.get('/api/ocean-shipments/documentos/:shipmentId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { shipmentId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documentos = await OceanShipmentDocumento.find({
      shipmentId: String(shipmentId),
      ...buildDocumentOwnerScopeQuery(ownerUsername),
    })
      .select('-contenidoBase64')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      documentos: documentos.map((doc) => ({
        id: doc._id,
        shipmentId: doc.shipmentId,
        tipo: doc.tipo,
        nombreArchivo: doc.nombreArchivo,
        tipoArchivo: doc.tipoArchivo,
        tamanoMB: (doc.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: doc.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al obtener documentos' });
  }
});

app.get('/api/ocean-shipments/documentos/download/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { documentoId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await OceanShipmentDocumento.findById(documentoId);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para descargar este documento' });
    }

    // R2 path: proxy binary
    if (documento.r2Key) {
      try {
        const docBuffer = await downloadDocumentBuffer(documento.r2Key);
        res.setHeader('Content-Type', documento.tipoArchivo || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documento.nombreArchivo)}"`);
        res.setHeader('Content-Length', docBuffer.length.toString());
        return res.end(docBuffer);
      } catch (r2Err: any) {
        console.error('[ocean-documentos] Error al descargar de R2:', r2Err);
        return res.status(500).json({ error: 'Error al descargar documento de almacenamiento' });
      }
    }

    // Legacy path: base64 from MongoDB
    return res.json({
      success: true,
      documento: {
        id: documento._id,
        shipmentId: documento.shipmentId,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoMB: (documento.tamanoBytes / 1024 / 1024).toFixed(2),
        contenidoBase64: documento.contenidoBase64,
        fechaSubida: documento.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al descargar documento' });
  }
});

app.delete('/api/ocean-shipments/documentos/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { documentoId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await OceanShipmentDocumento.findById(documentoId);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este documento' });
    }

    // Delete from R2 if stored there
    if (documento.r2Key) {
      try {
        await deleteDocument(documento.r2Key);
      } catch (r2Err) {
        console.error('[ocean-documentos] Error al eliminar de R2:', r2Err);
      }
    }

    await OceanShipmentDocumento.findByIdAndDelete(documentoId);
    return res.json({ success: true, message: 'Documento eliminado exitosamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al eliminar documento' });
  }
});

// ============================================================
// RUTAS DE DOCUMENTOS (GROUND SHIPMENTS)
// ============================================================

app.post('/api/ground-shipments/documentos/upload', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username || !currentUser?.sub) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { shipmentId, tipo, nombreArchivo, contenidoBase64 } = req.body;

    if (!shipmentId || !tipo || !nombreArchivo || !contenidoBase64) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: shipmentId, tipo, nombreArchivo, contenidoBase64',
      });
    }

    const tiposPermitidos = [
      'Carta de porte / Guía de remisión / CMR',
      'Prueba de entrega (POD / remito firmado)',
      'Factura comercial (Invoice)',
      'Packing List',
      'Póliza/Certificado de seguro de transporte',
      'Permisos/autorizaciones (sobredimensionada, especiales)',
      'Documentación del vehículo y conductor (licencia, tarjeta)',
      'Documentos aduaneros/transito (T1, TIR, manifiesto)',
      'Documentos ADR / MSDS (mercancías peligrosas)',
      'Orden/confirmación y factura del transportista (freight invoice)',
      'Delivery Order / Warehouse Receipt (si hay almacenaje)',
      'Certificado de Origen',
      'Papeleta',
      'Otros Documentos',
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo de documento inválido. Debe ser uno de: ${tiposPermitidos.join(', ')}`,
      });
    }

    if (!validateBase64(contenidoBase64)) {
      return res.status(400).json({ error: 'El archivo debe estar en formato base64 válido' });
    }

    const mimeType = getMimeTypeFromBase64(contenidoBase64);
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF, Excel y Word' });
    }

    const fileSize = getBase64Size(contenidoBase64);
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `El archivo excede el tamaño máximo de 5MB. Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    // Upload to R2 instead of storing base64 in MongoDB
    const base64Content = contenidoBase64.includes('base64,')
      ? contenidoBase64.split('base64,')[1]
      : contenidoBase64;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const docId = new mongoose.Types.ObjectId();
    const r2Key = buildDocR2Key('ground', ownerUsername, String(shipmentId), docId.toString(), String(nombreArchivo));

    await uploadDocument(r2Key, fileBuffer, mimeType);

    const nuevoDocumento = await GroundShipmentDocumento.create({
      _id: docId,
      shipmentId: String(shipmentId),
      tipo,
      nombreArchivo: String(nombreArchivo),
      tipoArchivo: mimeType,
      tamanoBytes: fileSize,
      r2Key,
      subidoPor: currentUser.sub,
      usuarioId: ownerUsername,
    });

    // Fire-and-forget: notificar por email
    sendDocumentUploadNotification({
      uploaderEmail: currentUser.sub,
      ownerUsername,
      numero: String(shipmentId),
      tipoOperacion: 'Operación Terrestre',
      tipoDocumento: tipo,
      nombreArchivo: String(nombreArchivo),
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      documento: {
        id: nuevoDocumento._id,
        shipmentId: nuevoDocumento.shipmentId,
        tipo: nuevoDocumento.tipo,
        nombreArchivo: nuevoDocumento.nombreArchivo,
        tipoArchivo: nuevoDocumento.tipoArchivo,
        tamanoMB: (nuevoDocumento.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: nuevoDocumento.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al subir documento' });
  }
});

app.get('/api/ground-shipments/documentos/:shipmentId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { shipmentId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documentos = await GroundShipmentDocumento.find({
      shipmentId: String(shipmentId),
      ...buildDocumentOwnerScopeQuery(ownerUsername),
    })
      .select('-contenidoBase64')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      documentos: documentos.map((doc: any) => ({
        id: doc._id,
        shipmentId: doc.shipmentId,
        tipo: doc.tipo,
        nombreArchivo: doc.nombreArchivo,
        tipoArchivo: doc.tipoArchivo,
        tamanoMB: (doc.tamanoBytes / 1024 / 1024).toFixed(2),
        fechaSubida: doc.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al obtener documentos' });
  }
});

app.get('/api/ground-shipments/documentos/download/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { documentoId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await GroundShipmentDocumento.findById(documentoId);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para descargar este documento' });
    }

    // R2 path: proxy binary
    if (documento.r2Key) {
      try {
        const docBuffer = await downloadDocumentBuffer(documento.r2Key);
        res.setHeader('Content-Type', documento.tipoArchivo || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documento.nombreArchivo)}"`);
        res.setHeader('Content-Length', docBuffer.length.toString());
        return res.end(docBuffer);
      } catch (r2Err: any) {
        console.error('[ground-documentos] Error al descargar de R2:', r2Err);
        return res.status(500).json({ error: 'Error al descargar documento de almacenamiento' });
      }
    }

    // Legacy path: base64 from MongoDB
    return res.json({
      success: true,
      documento: {
        id: documento._id,
        shipmentId: documento.shipmentId,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoMB: (documento.tamanoBytes / 1024 / 1024).toFixed(2),
        contenidoBase64: documento.contenidoBase64,
        fechaSubida: documento.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al descargar documento' });
  }
});

app.delete('/api/ground-shipments/documentos/:documentoId', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'Usuario no autenticado' });

    const { documentoId } = req.params;

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const documento = await GroundShipmentDocumento.findById(documentoId);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });

    if (!documentBelongsToOwnerScope(documento, ownerUsername)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este documento' });
    }

    // Delete from R2 if stored there
    if (documento.r2Key) {
      try {
        await deleteDocument(documento.r2Key);
      } catch (r2Err) {
        console.error('[ground-documentos] Error al eliminar de R2:', r2Err);
      }
    }

    await GroundShipmentDocumento.findByIdAndDelete(documentoId);
    return res.json({ success: true, message: 'Documento eliminado exitosamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al eliminar documento' });
  }
});

// POST /api/google-sheets/append - Enviar datos a Google Sheets
app.post('/api/google-sheets/append', auth, async (req, res) => {
  try {
    const { values } = req.body;

    if (!values || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Invalid values array' });
    }

    // Validar que no esté vacío
    if (values.length === 0) {
      return res.status(400).json({ error: 'Values array cannot be empty' });
    }

    const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyYYU3sdPvU5svUgCWMovXMu4AeDpqvcpqTTjpiZoYTGQQbWsfDqSnt-SgKV2sEHXMz/exec';

    // Desde servidor a servidor NO hay restricciones CORS
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values })
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Failed to append to Google Sheets' 
      });
    }

    const data = await response.json();
    res.status(200).json({ 
      success: true, 
      message: 'Data appended successfully',
      data 
    });

  } catch (error: any) {
    console.error('❌ Error appending to Google Sheets:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// POST /api/send-oversize-email - Notificar al ejecutivo sobre carga especial (oversize / no apta / carguero)
app.post('/api/send-oversize-email', auth, async (req, res) => {
  try {
    console.log('Endpoint /api/send-oversize-email hit');
    const currentUser = await User.findOne({ email: (req as any).user.sub }).populate('ejecutivoId');
    if (!currentUser || !currentUser.ejecutivoId) {
      return res.status(400).json({ error: 'No se encontró ejecutivo asignado al usuario' });
    }

    const ejecutivoEmail = (currentUser.ejecutivoId as any).email;
    const { origen, destino, carrier, validUntil, motivos, descripcion, incoterm, piezas, clienteNombre, clienteEmail, cargos } = req.body;

    const emailData: OversizeEmailData = {
      clienteNombre: clienteNombre || currentUser.username,
      clienteEmail: clienteEmail || currentUser.email,
      origen: origen || '',
      destino: destino || '',
      carrier: carrier || '',
      descripcion: descripcion || '',
      incoterm: incoterm || '',
      validUntil: validUntil || '',
      motivos: motivos || [],
      piezas: piezas || [],
      cargos: cargos || undefined,
    };

    const subject = getOversizeEmailSubject(emailData);
    const htmlContent = buildOversizeEmailHTML(emailData);

    // Enviar correo usando Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Cotización Especial', email: 'noreply@sphereglobal.io' },
        to: [{ email: ejecutivoEmail }],
        subject,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Error enviando correo oversize con Brevo:', errorText);
    }

    res.json({ success: true, message: 'Notificación de carga especial enviada al ejecutivo' });
  } catch (err) {
    console.error('Error en /api/send-oversize-email:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/send-oversize-email-ocean - Notificar al ejecutivo sobre carga oversize marítima LCL
app.post('/api/send-oversize-email-ocean', auth, async (req, res) => {
  try {
    console.log('Endpoint /api/send-oversize-email-ocean hit');
    const currentUser = await User.findOne({ email: (req as any).user.sub }).populate('ejecutivoId');
    if (!currentUser || !currentUser.ejecutivoId) {
      return res.status(400).json({ error: 'No se encontró ejecutivo asignado al usuario' });
    }

    const ejecutivoEmail = (currentUser.ejecutivoId as any).email;
    const { origen, destino, operador, motivos, descripcion, incoterm, validUntil, piezas, clienteNombre, clienteEmail, cargos } = req.body;

    const emailData: OceanOversizeEmailData = {
      clienteNombre: clienteNombre || currentUser.username,
      clienteEmail: clienteEmail || currentUser.email,
      origen: origen || '',
      destino: destino || '',
      operador: operador || '',
      descripcion: descripcion || '',
      incoterm: incoterm || '',
      validUntil: validUntil || '',
      motivos: motivos || [],
      piezas: piezas || [],
      cargos: cargos || undefined,
    };

    const subject = getOceanOversizeEmailSubject(emailData);
    const htmlContent = buildOceanOversizeEmailHTML(emailData);

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Cotización Marítima Especial', email: 'noreply@sphereglobal.io' },
        to: [{ email: ejecutivoEmail }],
        subject,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Error enviando correo oversize ocean con Brevo:', errorText);
    }

    res.json({ success: true, message: 'Notificación de carga marítima especial enviada al ejecutivo' });
  } catch (err) {
    console.error('Error en /api/send-oversize-email-ocean:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/send-operation-email - Enviar notificación de nueva operación al ejecutivo
app.post('/api/send-operation-email', auth, async (req, res) => {
  try {
    console.log('Endpoint /api/send-operation-email hit');
    const currentUser = await User.findOne({ email: (req as any).user.sub }).populate('ejecutivoId');
    console.log('Current user:', currentUser?.email, 'Ejecutivo:', (currentUser?.ejecutivoId as any)?.email);
    if (!currentUser) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const {
      tipoServicio = 'Aéreo',
      origen,
      destino,
      carrier,
      currency,
      total,
      tipoAccion,
      tipo,
      ejecutivoEmail: ejecutivoEmailBody,
      ejecutivoNombre: ejecutivoNombreBody,
      clienteUsername: clienteUsernameBody,
      clienteNombre: clienteNombreBody,
      // Aéreo específico
      description,
      chargeableWeight,
      // FCL específico
      containerType,
      cantidadContenedores,
      incoterm,
      // EXW específico
      pickupFromAddress,
      deliveryToAddress,
      ultimaMilla,
      ultimaMillaDireccion,
      ultimaMillaMonto,
      ultimaMillaZonaExtendida,
      // Agente y número de cotización
      agente,
      quoteNumber,
      proveedor,
    } = req.body;

    const ejecutivoEmail =
      (typeof ejecutivoEmailBody === 'string' && ejecutivoEmailBody.trim()) ||
      (currentUser.ejecutivoId as any)?.email;
    const ejecutivoNombre =
      (typeof ejecutivoNombreBody === 'string' && ejecutivoNombreBody.trim()) ||
      (currentUser.ejecutivoId as any)?.nombre ||
      'Ejecutivo';
    const clienteUsername =
      (typeof clienteUsernameBody === 'string' && clienteUsernameBody.trim()) ||
      currentUser.username ||
      currentUser.email;
    const clienteNombreResolved =
      (typeof clienteNombreBody === 'string' && clienteNombreBody.trim()) ||
      currentUser.nombreuser;

    if (!ejecutivoEmail) {
      return res.status(400).json({ error: 'No se encontró ejecutivo asignado al usuario' });
    }

    const tipoAccionResolved = (tipoAccion || tipo) as 'cotizacion' | 'operacion' | undefined;

    let subject: string;
    let htmlContent: string;

    if (tipoServicio === 'Marítimo FCL') {
      const emailData: FclQuoteEmailData = {
        ejecutivoNombre,
        clienteUsername,
        clienteNombre: clienteNombreResolved,
        pol: origen || '',
        pod: destino || '',
        carrier: carrier || '',
        containerType: containerType || undefined,
        cantidadContenedores: cantidadContenedores || undefined,
        incoterm: incoterm || undefined,
        currency: currency || 'USD',
        total: total || '',
        tipoAccion: tipoAccionResolved,
        pickupFromAddress: incoterm === 'EXW' ? (pickupFromAddress || undefined) : undefined,
        deliveryToAddress: incoterm === 'EXW' ? (deliveryToAddress || undefined) : undefined,
        ultimaMilla: ultimaMilla || undefined,
        ultimaMillaDireccion: ultimaMilla ? ultimaMillaDireccion : undefined,
        ultimaMillaMonto: ultimaMilla ? ultimaMillaMonto : undefined,
        ultimaMillaZonaExtendida: ultimaMilla ? ultimaMillaZonaExtendida : undefined,
        agente: agente || undefined,
        quoteNumber: quoteNumber || undefined,
        proveedor: proveedor || undefined,
      };
      subject = getFclQuoteEmailSubject(emailData);
      htmlContent = buildFclQuoteEmailHTML(emailData);
    } else if (tipoServicio === 'Marítimo LCL') {
      const emailData: LclQuoteEmailData = {
        ejecutivoNombre,
        clienteUsername,
        clienteNombre: clienteNombreResolved,
        pol: origen || '',
        pod: destino || '',
        operador: carrier || '',
        incoterm: incoterm || undefined,
        currency: currency || 'USD',
        total: total || '',
        tipoAccion: tipoAccionResolved,
        pickupFromAddress: incoterm === 'EXW' ? (pickupFromAddress || undefined) : undefined,
        deliveryToAddress: incoterm === 'EXW' ? (deliveryToAddress || undefined) : undefined,
        ultimaMilla: ultimaMilla || undefined,
        ultimaMillaDireccion: ultimaMilla ? ultimaMillaDireccion : undefined,
        ultimaMillaMonto: ultimaMilla ? ultimaMillaMonto : undefined,
        ultimaMillaZonaExtendida: ultimaMilla ? ultimaMillaZonaExtendida : undefined,
        agente: agente || undefined,
        quoteNumber: quoteNumber || undefined,
        proveedor: proveedor || undefined,
      };
      subject = getLclQuoteEmailSubject(emailData);
      htmlContent = buildLclQuoteEmailHTML(emailData);
    } else if (tipoServicio === 'Última Milla') {
      // LASTMILE notifications are handled by /api/send-no-rate-quote-email
      return res.status(200).json({ success: true });
    } else {
      // Aéreo
      const emailData: AirQuoteEmailData = {
        ejecutivoNombre,
        clienteUsername,
        clienteNombre: clienteNombreResolved,
        origen: origen || '',
        destino: destino || '',
        carrier: carrier || '',
        descripcionCarga: description || '',
        pesoChargeable: chargeableWeight || '',
        currency: currency || 'USD',
        total: total || '',
        tipoAccion: tipoAccionResolved,
        incoterm: incoterm || undefined,
        pickupFromAddress: incoterm === 'EXW' ? (pickupFromAddress || undefined) : undefined,
        deliveryToAddress: incoterm === 'EXW' ? (deliveryToAddress || undefined) : undefined,
        ultimaMilla: ultimaMilla || undefined,
        ultimaMillaDireccion: ultimaMilla ? ultimaMillaDireccion : undefined,
        ultimaMillaMonto: ultimaMilla ? ultimaMillaMonto : undefined,
        ultimaMillaZonaExtendida: ultimaMilla ? ultimaMillaZonaExtendida : undefined,
        agente: agente || undefined,
        quoteNumber: quoteNumber || undefined,
        proveedor: proveedor || undefined,
      };
      subject = getAirQuoteEmailSubject(emailData);
      htmlContent = buildAirQuoteEmailHTML(emailData);
    }

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Portal Clientes Seemann Group', email: 'noreply@sphereglobal.io' },
        to: [{ email: ejecutivoEmail }],
        subject,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Error enviando correo con Brevo:', errorText);
    }

    res.json({ success: true, message: 'Notificación enviada al ejecutivo' });
  } catch (err) {
    console.error('Error en /api/send-operation-email:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// CLIENTE-PROVEEDORES + OPERACIONES
// ============================================================

// GET /api/cliente-proveedores - Lista proveedores guardados por el cliente actual
app.get('/api/cliente-proveedores', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.username) return res.status(401).json({ error: 'No autorizado' });

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      (req.query?.ownerUsername as string) || undefined,
    );

    const proveedores = await ClienteProveedor.find({ usuarioId: ownerUsername })
      .sort({ ultimoUso: -1, updatedAt: -1 })
      .limit(50)
      .lean();

    res.json({
      proveedores: proveedores.map((p: any) => ({
        id: String(p._id),
        nombreEmpresa: p.nombreEmpresa,
        nombreContacto: p.nombreContacto,
        email: p.email,
        telefono: p.telefono,
      })),
    });
  } catch (err) {
    console.error('[cliente-proveedores] Error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/operaciones - Crear operación a partir de cotización (atómico)
app.post('/api/operaciones', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.sub || !currentUser?.username) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const {
      quoteNumber,
      quoteId,
      tipoServicio,
      proveedor,
      documentos,
      emailContext,
    } = req.body || {};

    if (!quoteNumber || !tipoServicio) {
      return res.status(400).json({ error: 'Faltan quoteNumber o tipoServicio' });
    }
    if (!['AIR', 'FCL', 'LCL'].includes(tipoServicio)) {
      return res.status(400).json({ error: 'tipoServicio debe ser AIR, FCL o LCL' });
    }
    if (!proveedor || typeof proveedor !== 'object') {
      return res.status(400).json({ error: 'Datos de proveedor requeridos' });
    }
    const provFields = ['nombreEmpresa', 'nombreContacto', 'email', 'telefono'] as const;
    for (const f of provFields) {
      if (!proveedor[f] || String(proveedor[f]).trim() === '') {
        return res.status(400).json({ error: `Campo proveedor.${f} requerido` });
      }
    }
    if (!EMAIL_REGEX.test(String(proveedor.email))) {
      return res.status(400).json({ error: 'Email del proveedor inválido' });
    }
    if (!Array.isArray(documentos)) {
      return res.status(400).json({ error: 'documentos debe ser un arreglo' });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const quotePdf = await QuotePDF.findOne({ quoteNumber, usuarioId: ownerUsername }).lean();
    if (!quotePdf) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const yaExiste = await Operacion.findOne({ quoteNumber, usuarioId: ownerUsername }).lean();
    if (yaExiste) {
      return res.status(409).json({ error: 'Ya existe una operación para esta cotización' });
    }

    const tiposPermitidos = ['Orden de compra', 'Invoice', 'Packing List', 'Certificado de Origen', 'Póliza de seguro', 'Guía de Despacho', 'Declaración de Ingreso'];

    for (const d of documentos) {
      if (!d?.tipo || !d?.nombreArchivo || !d?.contenidoBase64) {
        return res.status(400).json({ error: 'Cada documento requiere tipo, nombreArchivo y contenidoBase64' });
      }
      if (!tiposPermitidos.includes(d.tipo)) {
        return res.status(400).json({ error: `Tipo de documento inválido: ${d.tipo}` });
      }
      if (!validateBase64(d.contenidoBase64)) {
        return res.status(400).json({ error: `Documento "${d.nombreArchivo}" no es base64 válido` });
      }
      const mimeType = getMimeTypeFromBase64(d.contenidoBase64);
      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({ error: `Tipo de archivo no permitido para "${d.nombreArchivo}"` });
      }
      const fileSize = getBase64Size(d.contenidoBase64);
      if (fileSize > MAX_FILE_SIZE) {
        return res.status(400).json({ error: `"${d.nombreArchivo}" excede 5MB` });
      }
    }

    const docIdsCreados: mongoose.Types.ObjectId[] = [];
    for (const d of documentos) {
      const mimeType = getMimeTypeFromBase64(d.contenidoBase64) as string;
      const fileSize = getBase64Size(d.contenidoBase64);
      const base64Content = d.contenidoBase64.includes('base64,')
        ? d.contenidoBase64.split('base64,')[1]
        : d.contenidoBase64;
      const fileBuffer = Buffer.from(base64Content, 'base64');
      const docId = new mongoose.Types.ObjectId();
      // La carpeta en R2 es el número de cotización stripped + 84 (offset de IDs internos de Linbis)
      const strippedNum = parseInt(String(quoteNumber).replace(/^[A-Za-z]+0*/, ''), 10);
      const quoteFolder = !isNaN(strippedNum) ? String(strippedNum + 84) : String(quoteNumber);
      const r2Key = buildDocR2Key('documentos', ownerUsername, quoteFolder, docId.toString(), String(d.nombreArchivo));

      await uploadDocument(r2Key, fileBuffer, mimeType);

      await Documento.create({
        _id: docId,
        quoteId: quoteFolder,
        tipo: d.tipo,
        nombreArchivo: String(d.nombreArchivo),
        tipoArchivo: mimeType,
        tamanoBytes: fileSize,
        r2Key,
        subidoPor: currentUser.sub,
        usuarioId: ownerUsername,
      });
      docIdsCreados.push(docId);
    }

    const ec = (emailContext && typeof emailContext === 'object') ? emailContext : {};
    const operacion = await Operacion.create({
      quoteNumber: String(quoteNumber),
      quoteId: quoteId ? String(quoteId) : null,
      usuarioId: ownerUsername,
      generadoPor: currentUser.sub,
      tipoServicio,
      proveedor: {
        nombreEmpresa: String(proveedor.nombreEmpresa).trim(),
        nombreContacto: String(proveedor.nombreContacto).trim(),
        email: String(proveedor.email).toLowerCase().trim(),
        telefono: String(proveedor.telefono).trim(),
      },
      documentos: docIdsCreados,
      origen: ec.origen || (quotePdf as any).origen || '',
      destino: ec.destino || (quotePdf as any).destino || '',
      carrier: ec.carrier || '',
      containerType: ec.containerType || '',
      cantidadContenedores: typeof ec.cantidadContenedores === 'number' ? ec.cantidadContenedores : undefined,
      incoterm: ec.incoterm || '',
      pickupFromAddress: ec.pickupFromAddress || '',
      deliveryToAddress: ec.deliveryToAddress || '',
      description: ec.description || '',
      chargeableWeight: ec.chargeableWeight ? String(ec.chargeableWeight) : '',
      currency: ec.currency || '',
      total: ec.total || '',
      agente: ec.agente || '',
    });

    const nombreEmpresaNormalizado = normalizeEmpresaName(operacion.proveedor.nombreEmpresa);
    try {
      await ClienteProveedor.updateOne(
        { usuarioId: ownerUsername, nombreEmpresaNormalizado },
        {
          $set: {
            usuarioId: ownerUsername,
            nombreEmpresa: operacion.proveedor.nombreEmpresa,
            nombreEmpresaNormalizado,
            nombreContacto: operacion.proveedor.nombreContacto,
            email: operacion.proveedor.email,
            telefono: operacion.proveedor.telefono,
            ultimoUso: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (provErr) {
      console.error('[operaciones] Error upsert proveedor:', provErr);
    }

    try {
      const ownerUserDoc = await User.findOne({
        $or: [{ username: ownerUsername }, { usernames: ownerUsername }],
      }).populate('ejecutivoId');
      const ejecutivoEmail = (ownerUserDoc?.ejecutivoId as any)?.email;
      const ejecutivoNombre = (ownerUserDoc?.ejecutivoId as any)?.nombre || 'Ejecutivo';

      if (ejecutivoEmail && process.env.BREVO_API_KEY) {
        const tipoServicioLabel =
          tipoServicio === 'FCL' ? 'Marítimo FCL'
          : tipoServicio === 'LCL' ? 'Marítimo LCL'
          : 'Aéreo';

        let subject: string;
        let htmlContent: string;
        const baseEmail = {
          ejecutivoNombre,
          clienteUsername: ownerUserDoc?.username || ownerUsername,
          clienteNombre: ownerUserDoc?.nombreuser,
          currency: operacion.currency || 'USD',
          total: operacion.total || '',
          tipoAccion: 'operacion' as const,
          incoterm: operacion.incoterm || undefined,
          pickupFromAddress: operacion.incoterm === 'EXW' ? (operacion.pickupFromAddress || undefined) : undefined,
          deliveryToAddress: operacion.incoterm === 'EXW' ? (operacion.deliveryToAddress || undefined) : undefined,
          agente: operacion.agente || undefined,
          quoteNumber: operacion.quoteNumber,
          proveedor: operacion.proveedor,
        };

        if (tipoServicioLabel === 'Marítimo FCL') {
          const data: FclQuoteEmailData = {
            ...baseEmail,
            pol: operacion.origen || '',
            pod: operacion.destino || '',
            carrier: operacion.carrier || '',
            containerType: operacion.containerType || undefined,
            cantidadContenedores: operacion.cantidadContenedores || undefined,
          };
          subject = getFclQuoteEmailSubject(data);
          htmlContent = buildFclQuoteEmailHTML(data);
        } else if (tipoServicioLabel === 'Marítimo LCL') {
          const data: LclQuoteEmailData = {
            ...baseEmail,
            pol: operacion.origen || '',
            pod: operacion.destino || '',
            operador: operacion.carrier || '',
          };
          subject = getLclQuoteEmailSubject(data);
          htmlContent = buildLclQuoteEmailHTML(data);
        } else {
          const data: AirQuoteEmailData = {
            ...baseEmail,
            origen: operacion.origen || '',
            destino: operacion.destino || '',
            carrier: operacion.carrier || '',
            descripcionCarga: operacion.description || '',
            pesoChargeable: operacion.chargeableWeight || '',
          };
          subject = getAirQuoteEmailSubject(data);
          htmlContent = buildAirQuoteEmailHTML(data);
        }

        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'Portal Clientes Seemann Group', email: 'noreply@sphereglobal.io' },
            to: [{ email: ejecutivoEmail }],
            subject,
            htmlContent,
          }),
        }).catch((e) => console.error('[operaciones] Error email:', e));
      }
    } catch (emailErr) {
      console.error('[operaciones] Error preparando email:', emailErr);
    }

    return res.status(201).json({
      success: true,
      operacion: {
        id: String(operacion._id),
        quoteNumber: operacion.quoteNumber,
        tipoServicio: operacion.tipoServicio,
        proveedor: operacion.proveedor,
        documentosCount: docIdsCreados.length,
        createdAt: operacion.createdAt,
      },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Ya existe una operación para esta cotización' });
    }
    console.error('[operaciones] Error:', err);
    res.status(500).json({ error: 'Error interno al crear operación' });
  }
});

// POST /api/send-special-quote-email - Notificar al ejecutivo que el cliente necesita cotización especial
app.post('/api/send-special-quote-email', auth, async (req, res) => {
  try {
    const currentUser = await User.findOne({ email: (req as any).user.sub }).populate('ejecutivoId');
    if (!currentUser || !currentUser.ejecutivoId) {
      return res.status(400).json({ error: 'No se encontró ejecutivo asignado al usuario' });
    }

    const ejecutivoEmail = (currentUser.ejecutivoId as any).email;
    const ejecutivoNombre = (currentUser.ejecutivoId as any).nombre || 'Ejecutivo';
    const clienteUsername = currentUser.username || currentUser.email;

    const emailData: SpecialQuoteEmailData = {
      ejecutivoNombre,
      clienteUsername,
      clienteEmail: currentUser.email,
    };

    const subject = getSpecialQuoteEmailSubject(emailData);
    const htmlContent = buildSpecialQuoteEmailHTML(emailData);

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Portal Clientes Seemann Group', email: 'noreply@sphereglobal.io' },
        to: [{ email: ejecutivoEmail }],
        subject,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      const errText = await brevoResponse.text();
      console.error('Error enviando correo especial con Brevo:', errText);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error en /api/send-special-quote-email:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/send-no-rate-quote-email - Notificar al ejecutivo de cotización sin tarifa (ruta no recurrente)
app.post('/api/send-no-rate-quote-email', auth, async (req, res) => {
  try {
    const currentUser = await User.findOne({ email: (req as any).user.sub }).populate('ejecutivoId');
    if (!currentUser || !currentUser.ejecutivoId) {
      return res.status(400).json({ error: 'No se encontró ejecutivo asignado al usuario' });
    }

    const ejecutivoEmail = (currentUser.ejecutivoId as any).email;
    const ejecutivoNombre = (currentUser.ejecutivoId as any).nombre || 'Ejecutivo';
    const clienteUsername = currentUser.username || currentUser.email;

    const { quoteType, cargoDetails } = req.body as {
      quoteType: 'AIR' | 'FCL' | 'LCL' | 'LASTMILE';
      cargoDetails: Record<string, unknown>;
      quoteNumber?: string;
    };
    const noRateQuoteNumber: string | undefined = req.body.quoteNumber;

    const emailData: NoRateQuoteEmailData = {
      ejecutivoNombre,
      clienteUsername,
      quoteType,
      cargoDetails,
      quoteNumber: noRateQuoteNumber || undefined,
    };

    const subject = getNoRateQuoteEmailSubject(emailData);
    const htmlContent = buildNoRateQuoteEmailHTML(emailData);

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Portal Clientes Seemann Group', email: 'noreply@sphereglobal.io' },
        to: [{ email: ejecutivoEmail }],
        subject,
        htmlContent,
      }),
    });

    if (!brevoRes.ok) {
      console.error('[no-rate-email] Brevo error:', await brevoRes.text());
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error en /api/send-no-rate-quote-email:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// RUTA: SIMULADOR DE COTIZACIONES
// ============================================================

// POST /api/send-simulated-quote-email - Enviar notificación de simulación al propio ejecutivo
app.post('/api/send-simulated-quote-email', auth, async (req, res) => {
  try {
    const authUser = (req as any).user;
    const me = await User.findOne({ email: authUser.sub });
    if (!me) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const ejDoc = await Ejecutivo.findOne({ email: me.email });
    const ejecutivoEmail = ejDoc?.email || me.email;
    const ejecutivoNombre = ejDoc?.nombre || me.nombreuser || me.username;

    const {
      tipoServicio,
      clienteUsername,
      clienteNombre,
      carrier,
      currency,
      total,
      incoterm,
      pickupFromAddress,
      deliveryToAddress,
      quoteNumber,
      origen,
      destino,
      description,
      chargeableWeight,
      containerType,
      cantidadContenedores,
    } = req.body as any;

    let subject: string;
    let htmlContent: string;

    if (tipoServicio === 'Marítimo FCL') {
      const emailData: FclQuoteEmailData = {
        ejecutivoNombre,
        clienteUsername: clienteUsername || me.username,
        clienteNombre: clienteNombre || undefined,
        pol: origen || '',
        pod: destino || '',
        carrier: carrier || '',
        containerType: containerType || undefined,
        cantidadContenedores: cantidadContenedores || undefined,
        incoterm: incoterm || undefined,
        pickupFromAddress: incoterm === 'EXW' ? pickupFromAddress : undefined,
        deliveryToAddress: incoterm === 'EXW' ? deliveryToAddress : undefined,
        currency: currency || 'USD',
        total: total || '',
        tipoAccion: 'cotizacion',
        quoteNumber: quoteNumber || undefined,
      };
      subject = `Se ha simulado una cotización FCL — ${clienteUsername || me.username}`;
      htmlContent = buildFclQuoteEmailHTML(emailData);
    } else if (tipoServicio === 'Marítimo LCL') {
      const emailData: LclQuoteEmailData = {
        ejecutivoNombre,
        clienteUsername: clienteUsername || me.username,
        clienteNombre: clienteNombre || undefined,
        pol: origen || '',
        pod: destino || '',
        operador: carrier || '',
        incoterm: incoterm || undefined,
        pickupFromAddress: incoterm === 'EXW' ? pickupFromAddress : undefined,
        deliveryToAddress: incoterm === 'EXW' ? deliveryToAddress : undefined,
        currency: currency || 'USD',
        total: total || '',
        tipoAccion: 'cotizacion',
        quoteNumber: quoteNumber || undefined,
      };
      subject = `Se ha simulado una cotización LCL — ${clienteUsername || me.username}`;
      htmlContent = buildLclQuoteEmailHTML(emailData);
    } else {
      const emailData: AirQuoteEmailData = {
        ejecutivoNombre,
        clienteUsername: clienteUsername || me.username,
        clienteNombre: clienteNombre || undefined,
        origen: origen || '',
        destino: destino || '',
        carrier: carrier || '',
        descripcionCarga: description || '',
        pesoChargeable: chargeableWeight ? String(chargeableWeight) : '',
        incoterm: incoterm || undefined,
        pickupFromAddress: incoterm === 'EXW' ? pickupFromAddress : undefined,
        deliveryToAddress: incoterm === 'EXW' ? deliveryToAddress : undefined,
        currency: currency || 'USD',
        total: total || '',
        tipoAccion: 'cotizacion',
        quoteNumber: quoteNumber || undefined,
      };
      subject = `Se ha simulado una cotización aérea — ${clienteUsername || me.username}`;
      htmlContent = buildAirQuoteEmailHTML(emailData);
    }

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Portal Clientes Seemann Group', email: 'noreply@sphereglobal.io' },
        to: [{ email: ejecutivoEmail }],
        subject,
        htmlContent,
      }),
    });

    if (!brevoResponse.ok) {
      const errText = await brevoResponse.text();
      console.error('[simulated-quote-email] Brevo error:', errText);
    }

    res.json({ success: true, message: 'Notificación de simulación enviada' });
  } catch (err) {
    console.error('[simulated-quote-email] Error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// RUTAS DE PDF DE COTIZACIONES
// ============================================================

// POST /api/quote-pdf/upload - Subir PDF de cotización (Cloudflare R2)
app.post('/api/quote-pdf/upload', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser || !currentUser.sub || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { quoteNumber, nombreArchivo, contenidoBase64, tipoServicio, origen, destino } = req.body;

    const overrideUsuarioId = typeof (req.body.usuarioId) === 'string' ? String(req.body.usuarioId) : null;
    const overrideSubidoPor = typeof (req.body.subidoPor) === 'string' ? String(req.body.subidoPor) : null;

    const shouldUseOverride =
      currentUser.username === 'Ejecutivo' && overrideUsuarioId && overrideSubidoPor;

    const resolvedUsuarioId = shouldUseOverride ? overrideUsuarioId : currentUser.username;
    const resolvedSubidoPor = shouldUseOverride ? overrideSubidoPor : currentUser.sub;

    if (!quoteNumber || !nombreArchivo || !contenidoBase64 || !tipoServicio) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: quoteNumber, nombreArchivo, contenidoBase64, tipoServicio'
      });
    }

    if (!['AIR', 'FCL', 'LCL', 'INTERNACIONALIZACION', 'LASTMILE'].includes(tipoServicio)) {
      return res.status(400).json({ error: 'tipoServicio debe ser AIR, FCL, LCL, INTERNACIONALIZACION o LASTMILE' });
    }

    // Extraer contenido base64 puro y convertir a Buffer
    const base64Content = contenidoBase64.includes('base64,')
      ? contenidoBase64.split('base64,')[1]
      : contenidoBase64;
    const pdfBuffer = Buffer.from(base64Content, 'base64');
    const fileSize = pdfBuffer.length;

    if (fileSize > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'El PDF excede el tamaño máximo de 10MB' });
    }

    // Construir clave R2 y subir a Cloudflare R2
    const r2Key = buildR2Key(resolvedUsuarioId!, quoteNumber);
    await uploadPDF(r2Key, pdfBuffer, {
      quoteNumber: String(quoteNumber),
      usuarioId: resolvedUsuarioId!,
      tipoServicio,
    });

    console.log(`[quote-pdf] PDF subido a R2: ${r2Key}`);

    // Guardar/actualizar metadatos en MongoDB (sin contenidoBase64)
    const existente = await QuotePDF.findOne({
      quoteNumber: String(quoteNumber),
      usuarioId: resolvedUsuarioId
    });

    if (existente) {
      existente.nombreArchivo = nombreArchivo;
      existente.tamanoBytes = fileSize;
      existente.tipoServicio = tipoServicio;
      existente.origen = origen || '';
      existente.destino = destino || '';
      existente.r2Key = r2Key;
      existente.contenidoBase64 = undefined;  // Limpiar legacy si existía
      await existente.save();

      console.log(`[quote-pdf] Metadatos actualizados para cotización ${quoteNumber}`);
      return res.status(200).json({
        success: true,
        message: 'PDF de cotización actualizado',
        quotePdf: {
          id: existente._id,
          quoteNumber: existente.quoteNumber,
          nombreArchivo: existente.nombreArchivo,
          tamanoMB: (existente.tamanoBytes / 1024 / 1024).toFixed(2),
        }
      });
    }

    const nuevoQuotePDF = await QuotePDF.create({
      quoteNumber: String(quoteNumber),
      nombreArchivo: String(nombreArchivo),
      tamanoBytes: fileSize,
      r2Key,
      tipoServicio,
      origen: origen || '',
      destino: destino || '',
      usuarioId: resolvedUsuarioId,
      subidoPor: resolvedSubidoPor,
    });

    console.log(`[quote-pdf] PDF subido para cotización ${quoteNumber}: ${nuevoQuotePDF._id}`);

    return res.status(201).json({
      success: true,
      message: 'PDF de cotización guardado',
      quotePdf: {
        id: nuevoQuotePDF._id,
        quoteNumber: nuevoQuotePDF.quoteNumber,
        nombreArchivo: nuevoQuotePDF.nombreArchivo,
        tamanoMB: (nuevoQuotePDF.tamanoBytes / 1024 / 1024).toFixed(2),
      }
    });
  } catch (error: any) {
    console.error('[quote-pdf] Error al subir:', error);
    return res.status(500).json({ error: 'Error interno al guardar PDF de cotización' });
  }
});

// GET /api/quote-pdf/list - Obtener lista de PDFs disponibles para el usuario
app.get('/api/quote-pdf/list', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;

    if (!currentUser || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const pdfs = await QuotePDF.find({ 
      usuarioId: ownerUsername,
      quoteNumber: { $exists: true, $nin: ['', null] }
    })
      .select('-contenidoBase64')
      .sort({ createdAt: -1 });

    const pdfList = pdfs.map(pdf => ({
      id: pdf._id,
      quoteNumber: pdf.quoteNumber,
      nombreArchivo: pdf.nombreArchivo,
      tipoServicio: pdf.tipoServicio,
      origen: pdf.origen,
      destino: pdf.destino,
      tamanoMB: (pdf.tamanoBytes / 1024 / 1024).toFixed(2),
      fechaCreacion: pdf.createdAt,
    }));

    console.log(`[quote-pdf] Listando PDFs para ${ownerUsername}: ${pdfs.length} encontrados`);
    console.log(`[quote-pdf] quoteNumbers en DB:`, pdfList.map(p => p.quoteNumber));

    return res.json({
      success: true,
      pdfs: pdfList,
    });
  } catch (error: any) {
    console.error('[quote-pdf] Error al listar:', error);
    return res.status(500).json({ error: 'Error interno al listar PDFs' });
  }
});

// DELETE /api/quote-pdf/cleanup - Eliminar todos los PDFs del usuario (R2 + MongoDB)
app.delete('/api/quote-pdf/cleanup', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Eliminar archivos de R2
    const r2Deleted = await deleteAllUserPDFs(currentUser.username);
    console.log(`[quote-pdf] R2 limpieza: ${r2Deleted} archivos eliminados para ${currentUser.username}`);

    // Eliminar metadatos de MongoDB
    const result = await QuotePDF.deleteMany({ usuarioId: currentUser.username });
    console.log(`[quote-pdf] MongoDB limpieza: ${result.deletedCount} registros eliminados para ${currentUser.username}`);

    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('[quote-pdf] Error en limpieza:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/quote-pdf/download/:quoteNumber - Descargar PDF de cotización (proxy R2 + legacy MongoDB)
app.get('/api/quote-pdf/download/:quoteNumber', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;

    if (!currentUser || !currentUser.username) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const { quoteNumber } = req.params;

    if (!quoteNumber) {
      return res.status(400).json({ error: 'quoteNumber es requerido' });
    }

    const ownerUsername = await resolveDocumentOwnerUsername(
      currentUser,
      getRequestedDocumentOwnerUsername(req),
    );

    const quotePdf = await QuotePDF.findOne({
      quoteNumber: decodeURIComponent(quoteNumber),
      usuarioId: ownerUsername
    });

    if (!quotePdf) {
      return res.status(404).json({ error: 'PDF de cotización no encontrado' });
    }

    console.log(`[quote-pdf] Descargando PDF cotización ${quoteNumber}`);

    // Nuevo flujo R2: proxy del binario para evitar CORS del navegador
    if (quotePdf.r2Key) {
      const pdfBuffer = await downloadPDFBuffer(quotePdf.r2Key);
      const filename = encodeURIComponent(quotePdf.nombreArchivo || `Cotizacion_${quoteNumber}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    // Fallback legacy: PDFs antiguos almacenados en MongoDB con contenidoBase64
    if (quotePdf.contenidoBase64) {
      return res.json({
        success: true,
        quotePdf: {
          id: quotePdf._id,
          quoteNumber: quotePdf.quoteNumber,
          nombreArchivo: quotePdf.nombreArchivo,
          tipoServicio: quotePdf.tipoServicio,
          contenidoBase64: quotePdf.contenidoBase64,
          tamanoMB: (quotePdf.tamanoBytes / 1024 / 1024).toFixed(2),
        }
      });
    }

    return res.status(404).json({ error: 'PDF no disponible' });
  } catch (error: any) {
    console.error('[quote-pdf] Error al descargar:', error);
    return res.status(500).json({ error: 'Error interno al descargar PDF' });
  }
});


// ============================================================
// RUTAS DE AUDITORÍA
// ============================================================

// POST /api/audit — Registrar evento de auditoría
app.post('/api/audit', auth, async (req, res) => {
  try {
    const { usuario, email, rol, ejecutivo, ejecutivoEmail, accion, categoria, descripcion, detalles, clienteAfectado } = req.body;

    if (!accion || !categoria || !descripcion) {
      return res.status(400).json({ error: 'accion, categoria y descripcion son requeridos' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

    const auditEntry = await AuditLog.create({
      usuario: usuario || (req as any).user?.username || 'desconocido',
      email: email || (req as any).user?.sub || '',
      rol: rol || 'cliente',
      ejecutivo: ejecutivo || null,
      ejecutivoEmail: ejecutivoEmail || null,
      accion,
      categoria,
      descripcion,
      detalles: detalles || {},
      clienteAfectado: clienteAfectado || null,
      ip: typeof ip === 'string' ? ip : Array.isArray(ip) ? ip[0] : null,
    });

    console.log(`[audit] ${accion} por ${usuario || 'unknown'} — ${descripcion}`);
    return res.status(201).json({ success: true, id: auditEntry._id });
  } catch (error: any) {
    console.error('[audit] Error al registrar evento:', error);
    return res.status(500).json({ error: 'Error al registrar evento de auditoría' });
  }
});

// GET /api/audit — Listar eventos de auditoría (solo ejecutivos/admins)
app.get('/api/audit', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    
    // Solo ejecutivos pueden ver la auditoría
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const {
      page = '1',
      limit = '50',
      categoria,
      accion,
      usuario,
      desde,
      hasta,
      busqueda,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const filter: any = {};
    if (categoria) filter.categoria = categoria;
    if (accion) filter.accion = accion;
    if (usuario) filter.usuario = { $regex: usuario, $options: 'i' };
    if (desde || hasta) {
      filter.createdAt = {};
      if (desde) filter.createdAt.$gte = new Date(desde);
      if (hasta) filter.createdAt.$lte = new Date(hasta + 'T23:59:59.999Z');
    }
    if (busqueda) {
      filter.$or = [
        { usuario: { $regex: busqueda, $options: 'i' } },
        { email: { $regex: busqueda, $options: 'i' } },
        { descripcion: { $regex: busqueda, $options: 'i' } },
        { accion: { $regex: busqueda, $options: 'i' } },
        { clienteAfectado: { $regex: busqueda, $options: 'i' } },
        { ejecutivo: { $regex: busqueda, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Estadísticas rápidas
    const stats = await AuditLog.aggregate([
      { $group: { _id: '$categoria', count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      stats: stats.reduce((acc: any, s: any) => {
        acc[s._id] = s.count;
        return acc;
      }, {}),
    });
  } catch (error: any) {
    console.error('[audit] Error al listar eventos:', error);
    return res.status(500).json({ error: 'Error al obtener auditoría' });
  }
});

// ============================================================
// RUTAS DE ALUMNOS PRÁCTICA
// ============================================================

// GET /api/alumnos - Obtener todos los alumnos ordenados por puntaje
app.get('/api/alumnos', auth, async (_req, res) => {
  try {
    // Incluir documentos legacy sin campo `activo`
    const filtroActivo = { $or: [{ activo: true }, { activo: { $exists: false } }] };
    const alumnos = await Alumno.find(filtroActivo).sort({ puntajeTotal: -1 }).lean();
    // Evitar cache de CDN/edge para respuesta dinámica
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ alumnos });
  } catch (error) {
    console.error('[alumnos] Error:', error);
    return res.status(500).json({ error: 'Error al obtener alumnos' });
  }
});

// POST /api/alumnos - Crear un nuevo alumno
app.post('/api/alumnos', auth, async (req, res) => {
  try {
    const { nombre, tipoEntrenamiento, puntaje } = req.body || {};
    if (!nombre || !tipoEntrenamiento || puntaje === undefined) {
      return res.status(400).json({ error: 'Nombre, tipo de entrenamiento y puntaje son requeridos' });
    }
    const puntajeNum = Number(puntaje);
    if (isNaN(puntajeNum) || puntajeNum < 0) {
      return res.status(400).json({ error: 'El puntaje debe ser un número válido >= 0' });
    }
    const alumno = await Alumno.create({
      nombre: nombre.trim(),
      tipoEntrenamiento: tipoEntrenamiento.trim(),
      puntajeTotal: puntajeNum,
      historial: [{ puntaje: puntajeNum, tipoEntrenamiento: tipoEntrenamiento.trim(), fecha: new Date() }],
    });
    return res.status(201).json({ alumno });
  } catch (error) {
    console.error('[alumnos] Error al crear alumno:', error);
    return res.status(500).json({ error: 'Error al crear alumno' });
  }
});

// POST /api/alumnos/puntaje - Agregar puntaje a un alumno existente
app.post('/api/alumnos/puntaje', auth, async (req, res) => {
  try {
    const { alumnoId, tipoEntrenamiento, puntaje } = req.body || {};
    if (!alumnoId || !tipoEntrenamiento || puntaje === undefined) {
      return res.status(400).json({ error: 'alumnoId, tipoEntrenamiento y puntaje son requeridos' });
    }
    const puntajeNum = Number(puntaje);
    if (isNaN(puntajeNum) || puntajeNum < 0) {
      return res.status(400).json({ error: 'El puntaje debe ser un número válido >= 0' });
    }
    const alumno = await Alumno.findByIdAndUpdate(
      alumnoId,
      {
        $inc: { puntajeTotal: puntajeNum },
        $set: { tipoEntrenamiento: tipoEntrenamiento.trim() },
        $push: { historial: { puntaje: puntajeNum, tipoEntrenamiento: tipoEntrenamiento.trim(), fecha: new Date() } },
      },
      { new: true }
    );
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    return res.json({ alumno });
  } catch (error) {
    console.error('[alumnos] Error al agregar puntaje:', error);
    return res.status(500).json({ error: 'Error al agregar puntaje' });
  }
});

// GET /api/alumnos/ranking - Ranking con filtros por semana/mes
app.get('/api/alumnos/ranking', auth, async (req, res) => {
  try {
    const periodo = (req.query.periodo as string) || 'total';
    const mes = req.query.mes as string | undefined;
    const anio = req.query.anio as string | undefined;

    const filtroActivo = { $or: [{ activo: true }, { activo: { $exists: false } }] };
    const alumnos = await Alumno.find(filtroActivo).lean();

    if (periodo === 'total') {
      const ranking = alumnos
        .map(a => ({ _id: a._id, nombre: a.nombre, tipoEntrenamiento: a.tipoEntrenamiento, puntajeTotal: a.puntajeTotal }))
        .sort((a, b) => b.puntajeTotal - a.puntajeTotal);
      return res.json({ ranking, periodo });
    }

    let fechaInicio: Date;
    let fechaFin: Date;

    if (periodo === 'semana') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      fechaInicio = new Date(now);
      fechaInicio.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin = new Date(now);
      fechaFin.setHours(23, 59, 59, 999);
    } else {
      const m = mes !== undefined ? parseInt(mes) : new Date().getMonth();
      const y = anio ? parseInt(anio) : new Date().getFullYear();
      fechaInicio = new Date(y, m, 1);
      fechaFin = new Date(y, m + 1, 0, 23, 59, 59, 999);
    }

    const ranking = alumnos.map(a => {
      const puntosPeriodo = (a.historial || [])
        .filter((h: any) => {
          const f = new Date(h.fecha);
          return f >= fechaInicio && f <= fechaFin;
        })
        .reduce((sum: number, h: any) => sum + h.puntaje, 0);
      return {
        _id: a._id,
        nombre: a.nombre,
        tipoEntrenamiento: a.tipoEntrenamiento,
        puntajePeriodo: puntosPeriodo,
        puntajeTotal: a.puntajeTotal,
      };
    })
    .sort((a, b) => b.puntajePeriodo - a.puntajePeriodo);

    return res.json({ ranking, periodo, fechaInicio, fechaFin });
  } catch (error) {
    console.error('[alumnos] Error ranking:', error);
    return res.status(500).json({ error: 'Error al obtener ranking' });
  }
});

// GET /api/alumnos/detalle/:id - Obtener un alumno específico con historial
app.get('/api/alumnos/detalle/:id', auth, async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id).lean();
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    return res.json({ alumno });
  } catch (error) {
    console.error('[alumnos] Error:', error);
    return res.status(500).json({ error: 'Error al obtener alumno' });
  }
});

// DELETE /api/alumnos/:id - Desactivar alumno
app.delete('/api/alumnos/:id', auth, async (req, res) => {
  try {
    const alumno = await Alumno.findByIdAndUpdate(req.params.id, { activo: false }, { new: true });
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    return res.json({ message: 'Alumno desactivado', alumno });
  } catch (error) {
    console.error('[alumnos] Error al eliminar:', error);
    return res.status(500).json({ error: 'Error al eliminar alumno' });
  }
});

// ============================================================
// RUTAS DE ARCHIVOS DE PROVEEDORES
// ============================================================

const PROVEEDOR_ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv',
];

const PROVEEDOR_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/proveedor-archivos/upload
app.post('/api/proveedor-archivos/upload', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const { nombreArchivo, contenidoBase64, categoria } = req.body;

    if (!nombreArchivo || !contenidoBase64 || !categoria) {
      return res.status(400).json({ error: 'Faltan campos: nombreArchivo, contenidoBase64, categoria' });
    }

    const categoriasPermitidas = ['AEREO', 'FCL', 'LCL'];
    if (!categoriasPermitidas.includes(categoria)) {
      return res.status(400).json({ error: 'Categoría inválida. Debe ser AEREO, FCL o LCL' });
    }

    if (!validateBase64(contenidoBase64)) {
      return res.status(400).json({ error: 'Archivo en formato base64 inválido' });
    }

    const mimeType = getMimeTypeFromBase64(contenidoBase64);
    if (!mimeType || !PROVEEDOR_ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Solo se permiten archivos Excel (.xls, .xlsx, .csv)' });
    }

    const fileSize = getBase64Size(contenidoBase64);
    if (fileSize > PROVEEDOR_MAX_FILE_SIZE) {
      return res.status(400).json({ error: `El archivo excede 10MB. Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB` });
    }

    const userDoc = await User.findOne({ email: currentUser.sub });
    const proveedorNombre = userDoc?.nombreuser || userDoc?.email || 'Proveedor';

    const archivo = await ProveedorArchivo.create({
      nombreArchivo: String(nombreArchivo),
      tipoArchivo: mimeType,
      tamanoBytes: fileSize,
      contenidoBase64,
      categoria,
      subidoPor: currentUser.sub,
      proveedorNombre,
    });

    return res.status(201).json({
      success: true,
      archivo: {
        id: archivo._id,
        nombreArchivo: archivo.nombreArchivo,
        tipoArchivo: archivo.tipoArchivo,
        tamanoBytes: archivo.tamanoBytes,
        categoria: archivo.categoria,
        proveedorNombre: archivo.proveedorNombre,
        createdAt: archivo.createdAt,
      },
    });
  } catch (e) {
    console.error('[proveedor-archivos] Error upload:', e);
    return res.status(500).json({ error: 'Error al subir archivo' });
  }
});

// GET /api/proveedor-archivos
app.get('/api/proveedor-archivos', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const categoria = req.query.categoria as string | undefined;

    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub.toLowerCase() });
    const isPricingOrAdmin = !!(ejecutivoDoc?.roles?.pricing || ejecutivoDoc?.roles?.administrador);

    const filter: Record<string, unknown> = {};
    if (!isPricingOrAdmin) {
      filter.subidoPor = currentUser.sub;
    }
    if (categoria && ['AEREO', 'FCL', 'LCL'].includes(categoria)) {
      filter.categoria = categoria;
    }

    const archivos = await ProveedorArchivo.find(filter)
      .select('-contenidoBase64')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      archivos: archivos.map((a) => ({
        id: a._id,
        nombreArchivo: a.nombreArchivo,
        tipoArchivo: a.tipoArchivo,
        tamanoBytes: a.tamanoBytes,
        categoria: a.categoria,
        proveedorNombre: a.proveedorNombre,
        createdAt: a.createdAt,
      })),
    });
  } catch (e) {
    console.error('[proveedor-archivos] Error list:', e);
    return res.status(500).json({ error: 'Error al listar archivos' });
  }
});

// GET /api/proveedor-archivos/:id/download
app.get('/api/proveedor-archivos/:id/download', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;

    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub.toLowerCase() });
    const isPricingOrAdmin = !!(ejecutivoDoc?.roles?.pricing || ejecutivoDoc?.roles?.administrador);

    const query: Record<string, unknown> = { _id: req.params.id };
    if (!isPricingOrAdmin) {
      query.subidoPor = currentUser.sub;
    }
    const archivo = await ProveedorArchivo.findOne(query);

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    return res.json({
      success: true,
      archivo: {
        id: archivo._id,
        nombreArchivo: archivo.nombreArchivo,
        tipoArchivo: archivo.tipoArchivo,
        contenidoBase64: archivo.contenidoBase64,
      },
    });
  } catch (e) {
    console.error('[proveedor-archivos] Error download:', e);
    return res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// DELETE /api/proveedor-archivos/:id
app.delete('/api/proveedor-archivos/:id', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const archivo = await ProveedorArchivo.findOneAndDelete({
      _id: req.params.id,
      subidoPor: currentUser.sub,
    });

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    return res.json({ success: true, message: 'Archivo eliminado' });
  } catch (e) {
    console.error('[proveedor-archivos] Error delete:', e);
    return res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

// ============================================================
// AGENCIA DE ADUANAS - CONFIG ENDPOINTS
// ============================================================

// GET /api/agencia-aduana/config - Obtener configuración actual
app.get('/api/agencia-aduana/config', async (_req, res) => {
  try {
    let config = await AgenciaAduanaConfig.findOne();
    if (!config) {
      config = await AgenciaAduanaConfig.create(DEFAULT_CONFIG);
    }
    return res.json(config);
  } catch (e) {
    console.error('[agencia-aduana] Error GET config:', e);
    return res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PUT /api/agencia-aduana/config - Actualizar configuración (solo admin)
app.put('/api/agencia-aduana/config', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub });
    if (!ejecutivoDoc?.roles?.administrador) {
      return res.status(403).json({ error: 'Solo administradores pueden modificar la configuración' });
    }

    const { exchangeRates, charges } = req.body;
    if (!exchangeRates && !charges) {
      return res.status(400).json({ error: 'Debe enviar exchangeRates, charges o ambos' });
    }

    const updateData: Record<string, unknown> = { updatedBy: currentUser.sub };
    if (exchangeRates) {
      for (const [key, val] of Object.entries(exchangeRates)) {
        if (typeof val !== 'number' || val <= 0) {
          return res.status(400).json({ error: `Tasa de cambio inválida: ${key}` });
        }
        updateData[`exchangeRates.${key}`] = val;
      }
    }
    if (charges) {
      for (const [key, val] of Object.entries(charges)) {
        if (typeof val !== 'number' || val < 0) {
          return res.status(400).json({ error: `Valor de cobro inválido: ${key}` });
        }
        updateData[`charges.${key}`] = val;
      }
    }

    const config = await AgenciaAduanaConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true }
    );

    return res.json(config);
  } catch (e) {
    console.error('[agencia-aduana] Error PUT config:', e);
    return res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

// GET /api/agencia-aduana-fcl/config
app.get('/api/agencia-aduana-fcl/config', async (_req, res) => {
  try {
    let config = await AgenciaAduanaFclConfig.findOne();
    if (!config) {
      config = await AgenciaAduanaFclConfig.create(DEFAULT_FCL_CONFIG);
    }
    return res.json(config);
  } catch (e) {
    console.error('[agencia-aduana-fcl] Error GET config:', e);
    return res.status(500).json({ error: 'Error al obtener configuración FCL' });
  }
});

// PUT /api/agencia-aduana-fcl/config (solo admin)
app.put('/api/agencia-aduana-fcl/config', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub });
    if (!ejecutivoDoc?.roles?.administrador) {
      return res.status(403).json({ error: 'Solo administradores pueden modificar la configuración' });
    }

    const { charges } = req.body;
    if (!charges) {
      return res.status(400).json({ error: 'Debe enviar charges' });
    }

    const updateData: Record<string, unknown> = { updatedBy: currentUser.sub };
    for (const [key, val] of Object.entries(charges)) {
      if (typeof val !== 'number' || val < 0) {
        return res.status(400).json({ error: `Valor de cobro FCL inválido: ${key}` });
      }
      updateData[`charges.${key}`] = val;
    }

    const config = await AgenciaAduanaFclConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true },
    );

    return res.json(config);
  } catch (e) {
    console.error('[agencia-aduana-fcl] Error PUT config:', e);
    return res.status(500).json({ error: 'Error al actualizar configuración FCL' });
  }
});

// GET /api/agencia-aduana-lcl/config
app.get('/api/agencia-aduana-lcl/config', async (_req, res) => {
  try {
    let config = await AgenciaAduanaLclConfig.findOne();
    if (!config) {
      config = await AgenciaAduanaLclConfig.create(DEFAULT_LCL_CONFIG);
    }
    return res.json(config);
  } catch (e) {
    console.error('[agencia-aduana-lcl] Error GET config:', e);
    return res.status(500).json({ error: 'Error al obtener configuración LCL' });
  }
});

// PUT /api/agencia-aduana-lcl/config (solo admin)
app.put('/api/agencia-aduana-lcl/config', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub });
    if (!ejecutivoDoc?.roles?.administrador) {
      return res.status(403).json({ error: 'Solo administradores pueden modificar la configuración' });
    }

    const { charges } = req.body;
    if (!charges) {
      return res.status(400).json({ error: 'Debe enviar charges' });
    }

    const updateData: Record<string, unknown> = { updatedBy: currentUser.sub };
    for (const [key, val] of Object.entries(charges)) {
      if (typeof val !== 'number' || val < 0) {
        return res.status(400).json({ error: `Valor de cobro LCL inválido: ${key}` });
      }
      updateData[`charges.${key}`] = val;
    }

    const config = await AgenciaAduanaLclConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true },
    );

    return res.json(config);
  } catch (e) {
    console.error('[agencia-aduana-lcl] Error PUT config:', e);
    return res.status(500).json({ error: 'Error al actualizar configuración LCL' });
  }
});

// ============================================================
// GESTIÓN COTIZADOR - CONFIG ENDPOINTS
// ============================================================

// ============================================================
// FCL EXW - CONFIG ENDPOINTS (singleton)
// ============================================================

app.get('/api/fcl-exw/config', async (_req, res) => {
  try {
    let config = await FclExwConfig.findOne();
    if (!config) {
      config = await FclExwConfig.create(DEFAULT_FCL_EXW_CONFIG);
    }
    return res.json(config);
  } catch (e) {
    console.error('[fcl-exw] Error GET config:', e);
    return res.status(500).json({ error: 'Error al obtener configuración EXW FCL' });
  }
});

app.put('/api/fcl-exw/config', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub });
    if (!ejecutivoDoc?.roles?.administrador) {
      return res.status(403).json({
        error: 'Solo administradores pueden modificar la configuración EXW FCL',
      });
    }

    const { exw } = req.body as { exw?: Partial<IFclExwConfig> };
    if (!exw || typeof exw !== 'object') {
      return res.status(400).json({
        error: 'Debe enviar el objeto exw con los valores a actualizar',
      });
    }

    const updateData: Record<string, unknown> = { updatedBy: currentUser.sub };

    if (exw.exwRate20GP !== undefined) {
      if (typeof exw.exwRate20GP !== 'number' || exw.exwRate20GP <= 0) {
        return res.status(400).json({ error: 'Tarifa EXW 20GP inválida' });
      }
      updateData.exwRate20GP = exw.exwRate20GP;
    }

    if (exw.exwRate40 !== undefined) {
      if (typeof exw.exwRate40 !== 'number' || exw.exwRate40 <= 0) {
        return res.status(400).json({ error: 'Tarifa EXW 40 inválida' });
      }
      updateData.exwRate40 = exw.exwRate40;
    }

    if (Object.keys(updateData).length <= 1) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    const config = await FclExwConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true },
    );

    return res.json(config);
  } catch (e) {
    console.error('[fcl-exw] Error PUT config:', e);
    return res.status(500).json({ error: 'Error al actualizar configuración EXW FCL' });
  }
});

app.get('/api/gestion-cotizador/config', async (_req, res) => {
  try {
    let config = await GestionCotizadorConfig.findOne();
    if (!config) {
      config = await GestionCotizadorConfig.create(DEFAULT_GESTION_COTIZADOR_CONFIG);
    }
    return res.json(config);
  } catch (e) {
    console.error('[gestion-cotizador] Error GET config:', e);
    return res.status(500).json({ error: 'Error al obtener configuración del cotizador' });
  }
});

app.put('/api/gestion-cotizador/config', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const ejecutivoDoc = await Ejecutivo.findOne({ email: currentUser.sub });
    if (!ejecutivoDoc?.roles?.administrador) {
      return res.status(403).json({
        error: 'Solo administradores pueden modificar la configuración del cotizador',
      });
    }

    const { fcl, lcl, aereo } = req.body as {
      fcl?: Partial<IFclCotizadorConfig>;
      lcl?: Partial<ILclCotizadorConfig>;
      aereo?: Partial<IAereoCotizadorConfig>;
    };
    if (
      (!fcl || typeof fcl !== 'object') &&
      (!lcl || typeof lcl !== 'object') &&
      (!aereo || typeof aereo !== 'object')
    ) {
      return res.status(400).json({
        error: 'Debe enviar el objeto fcl, lcl y/o aereo con los valores a actualizar',
      });
    }

    const updateData: Record<string, unknown> = { updatedBy: currentUser.sub };

    if (fcl && typeof fcl === 'object') {
      if (fcl.ttRate20GP !== undefined) {
        if (typeof fcl.ttRate20GP !== 'number' || fcl.ttRate20GP <= 0) {
          return res.status(400).json({ error: 'Tarifa TT 20GP inválida' });
        }
        updateData['fcl.ttRate20GP'] = fcl.ttRate20GP;
      }
      if (fcl.ttRate40 !== undefined) {
        if (typeof fcl.ttRate40 !== 'number' || fcl.ttRate40 <= 0) {
          return res.status(400).json({ error: 'Tarifa TT 40 inválida' });
        }
        updateData['fcl.ttRate40'] = fcl.ttRate40;
      }
      if (fcl.vespucioExtendedSurchargePct !== undefined) {
        if (
          typeof fcl.vespucioExtendedSurchargePct !== 'number' ||
          fcl.vespucioExtendedSurchargePct < 0
        ) {
          return res.status(400).json({ error: 'Recargo zona extendida FCL inválido' });
        }
        updateData['fcl.vespucioExtendedSurchargePct'] =
          fcl.vespucioExtendedSurchargePct;
      }
    }

    if (lcl && typeof lcl === 'object') {
      if (lcl.vespucioExtendedSurchargePct !== undefined) {
        if (
          typeof lcl.vespucioExtendedSurchargePct !== 'number' ||
          lcl.vespucioExtendedSurchargePct < 0
        ) {
          return res.status(400).json({ error: 'Recargo zona extendida LCL inválido' });
        }
        updateData['lcl.vespucioExtendedSurchargePct'] =
          lcl.vespucioExtendedSurchargePct;
      }
      if (lcl.maxKg !== undefined) {
        if (typeof lcl.maxKg !== 'number' || lcl.maxKg <= 0) {
          return res.status(400).json({ error: 'Límite máximo kg LCL inválido' });
        }
        updateData['lcl.maxKg'] = lcl.maxKg;
      }
      if (lcl.maxM3 !== undefined) {
        if (typeof lcl.maxM3 !== 'number' || lcl.maxM3 <= 0) {
          return res.status(400).json({ error: 'Límite máximo m³ LCL inválido' });
        }
        updateData['lcl.maxM3'] = lcl.maxM3;
      }
      if (lcl.brackets !== undefined) {
        if (!Array.isArray(lcl.brackets) || lcl.brackets.length === 0) {
          return res.status(400).json({ error: 'Tabla de brackets LCL inválida' });
        }
        for (let i = 0; i < lcl.brackets.length; i++) {
          const b = lcl.brackets[i] as ILclDeliveryBracket;
          if (
            typeof b.maxKg !== 'number' ||
            typeof b.maxM3 !== 'number' ||
            typeof b.amount !== 'number' ||
            b.maxKg <= 0 ||
            b.maxM3 <= 0 ||
            b.amount <= 0
          ) {
            return res.status(400).json({ error: `Bracket LCL ${i + 1} inválido` });
          }
        }
        updateData['lcl.brackets'] = lcl.brackets;
      }
    }

    if (aereo && typeof aereo === 'object') {
      if (aereo.vespucioExtendedSurchargePct !== undefined) {
        if (
          typeof aereo.vespucioExtendedSurchargePct !== 'number' ||
          aereo.vespucioExtendedSurchargePct < 0
        ) {
          return res.status(400).json({ error: 'Recargo zona extendida AÉREO inválido' });
        }
        updateData['aereo.vespucioExtendedSurchargePct'] =
          aereo.vespucioExtendedSurchargePct;
      }
      if (aereo.maxKg !== undefined) {
        if (typeof aereo.maxKg !== 'number' || aereo.maxKg <= 0) {
          return res.status(400).json({ error: 'Límite máximo kg AÉREO inválido' });
        }
        updateData['aereo.maxKg'] = aereo.maxKg;
      }
      if (aereo.brackets !== undefined) {
        if (!Array.isArray(aereo.brackets) || aereo.brackets.length === 0) {
          return res.status(400).json({ error: 'Tabla de brackets AÉREO inválida' });
        }
        for (let i = 0; i < aereo.brackets.length; i++) {
          const b = aereo.brackets[i] as IAereoTtBracket;
          if (
            typeof b.maxKg !== 'number' ||
            typeof b.amount !== 'number' ||
            b.maxKg <= 0 ||
            b.amount <= 0
          ) {
            return res.status(400).json({ error: `Bracket AÉREO ${i + 1} inválido` });
          }
        }
        updateData['aereo.brackets'] = aereo.brackets;
      }
    }

    if (Object.keys(updateData).length <= 1) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    const config = await GestionCotizadorConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true },
    );

    return res.json(config);
  } catch (e) {
    console.error('[gestion-cotizador] Error PUT config:', e);
    return res.status(500).json({ error: 'Error al actualizar configuración del cotizador' });
  }
});

// ============================================================
// BEHAVIOR TRACKING
// ============================================================

// ============================================================
// PORTAL NOTIFICATIONS (alertas en navbar — multi-rol)
// ============================================================

app.get('/api/notifications', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const recipientEmail = String(currentUser.sub || '').toLowerCase().trim();
    if (!recipientEmail) return res.json({ notifications: [], unreadCount: 0 });

    const items = await PortalNotification.find({ recipientEmail })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = items.filter((n: any) => !n.read).length;
    return res.json({ notifications: items, unreadCount });
  } catch (error: any) {
    console.error('[notifications] Error GET:', error);
    return res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

app.patch('/api/notifications/read-all', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const recipientEmail = String(currentUser.sub || '').toLowerCase().trim();
    await PortalNotification.updateMany(
      { recipientEmail, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[notifications] Error read-all:', error);
    return res.status(500).json({ error: 'Error al marcar como leídas' });
  }
});

app.delete('/api/notifications/:id', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    const recipientEmail = String(currentUser.sub || '').toLowerCase().trim();
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await PortalNotification.deleteOne({ _id: id, recipientEmail });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[notifications] Error DELETE:', error);
    return res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

// POST /api/behavior-tracking — Receive tracking event
app.post('/api/behavior-tracking', async (req, res) => {
  try {
    const { clientEmail, clientUsername, sessionId, event, quoteType, step, route, incoterm, container, metadata, timestamp } = req.body || {};

    if (!clientEmail || !sessionId || !event || !quoteType) {
      return res.status(400).json({ error: 'clientEmail, sessionId, event y quoteType son requeridos' });
    }

    const validEvents = ['QUOTE_STARTED', 'QUOTE_STEP_CHANGED', 'QUOTE_ROUTE_SELECTED', 'QUOTE_COMPLETED', 'QUOTE_ABANDONED'];
    if (!validEvents.includes(event)) {
      return res.status(400).json({ error: `event debe ser uno de: ${validEvents.join(', ')}` });
    }

    const validTypes = ['AIR', 'FCL', 'LCL', 'LASTMILE'];
    if (!validTypes.includes(quoteType)) {
      return res.status(400).json({ error: `quoteType debe ser uno de: ${validTypes.join(', ')}` });
    }

    await QuoteTrackingEvent.create({
      clientEmail: String(clientEmail).toLowerCase().trim(),
      clientUsername: String(clientUsername).trim(),
      sessionId: String(sessionId),
      event,
      quoteType,
      step: step || undefined,
      route: route || undefined,
      incoterm: incoterm || undefined,
      container: container || undefined,
      metadata: metadata || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    if (event === 'QUOTE_COMPLETED' || event === 'QUOTE_ABANDONED') {
      void emitQuoteEventNotification({
        clientEmail,
        clientUsername,
        sessionId,
        event,
        quoteType,
        route,
        metadata,
      });
    }

    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('[behavior-tracking] Error POST:', error);
    return res.status(500).json({ error: 'Error al registrar evento' });
  }
});

// GET /api/behavior-tracking/clients — Summary for ejecutivo
app.get('/api/behavior-tracking/clients', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const ejecutivoUser = await User.findOne({ email: currentUser.sub }).populate('ejecutivoId');
    if (!ejecutivoUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let ejecutivoObjectId: any = null;
    if (ejecutivoUser.ejecutivoId) {
      ejecutivoObjectId = (ejecutivoUser.ejecutivoId as any)._id ?? ejecutivoUser.ejecutivoId;
    } else {
      const lookupEmail = String(ejecutivoUser.email).toLowerCase().trim();
      const ej = await Ejecutivo.findOne({ email: lookupEmail });
      if (ej) ejecutivoObjectId = ej._id;
    }

    if (!ejecutivoObjectId) {
      return res.json({ clients: [] });
    }

    const clients = await User.find(
      { ejecutivoId: ejecutivoObjectId, username: { $ne: 'Ejecutivo' } },
      { email: 1, username: 1, usernames: 1, nombreuser: 1 }
    );

    const clientEmails = clients.map(c => c.email.toLowerCase());
    if (clientEmails.length === 0) {
      return res.json({ clients: [] });
    }

    const behaviorStats = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails } } },
      // Stage 1: group events by session to determine per-session status
      {
        $group: {
          _id: { email: '$clientEmail', sessionId: '$sessionId' },
          hasStarted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_STARTED'] }, 1, 0] } },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
          lastActivity: { $max: '$timestamp' },
          quoteType: { $first: '$quoteType' },
        },
      },
      // Stage 2: roll up to client level counting sessions (not raw events)
      {
        $group: {
          _id: '$_id.email',
          totalEvents: { $sum: 1 },
          quotesStarted: { $sum: '$hasStarted' },
          quotesCompleted: { $sum: '$hasCompleted' },
          quotesAbandoned: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$hasAbandoned', 1] }, { $eq: ['$hasCompleted', 0] }] },
                1, 0,
              ],
            },
          },
          lastActivity: { $max: '$lastActivity' },
          quoteTypes: { $addToSet: '$quoteType' },
        },
      },
    ]);

    const statsMap = new Map(behaviorStats.map((s: any) => [s._id, s]));

    const result = clients.map((c) => {
      const stats = statsMap.get(c.email.toLowerCase()) || null;
      return {
        email: c.email,
        username: c.username,
        usernames: c.usernames,
        nombreuser: c.nombreuser,
        stats: stats
          ? {
              totalEvents: stats.totalEvents,
              quotesStarted: stats.quotesStarted,
              quotesCompleted: stats.quotesCompleted,
              quotesAbandoned: stats.quotesAbandoned,
              completionRate:
                stats.quotesStarted > 0
                  ? Math.round((stats.quotesCompleted / stats.quotesStarted) * 100)
                  : 0,
              lastActivity: stats.lastActivity,
              quoteTypes: stats.quoteTypes,
            }
          : null,
      };
    });

    return res.json({ clients: result });
  } catch (error: any) {
    console.error('[behavior-tracking] Error GET clients:', error);
    return res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/behavior-tracking/client/:email — Timeline for specific client
app.get('/api/behavior-tracking/client/:email', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const clientEmail = decodeURIComponent(req.params.email || '').toLowerCase().trim();
    if (!clientEmail) {
      return res.status(400).json({ error: 'Email de cliente requerido' });
    }

    const { desde, hasta, limit: limitStr } = req.query as Record<string, string>;
    const limit = Math.min(500, Math.max(1, parseInt(limitStr || '200')));

    const filter: any = { clientEmail };
    if (desde || hasta) {
      filter.timestamp = {};
      if (desde) filter.timestamp.$gte = new Date(desde);
      if (hasta) filter.timestamp.$lte = new Date(hasta + 'T23:59:59.999Z');
    }

    const events = await QuoteTrackingEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const sessionsMap = new Map<string, any[]>();
    for (const evt of events) {
      const sid = (evt as any).sessionId;
      if (!sessionsMap.has(sid)) sessionsMap.set(sid, []);
      sessionsMap.get(sid)!.push(evt);
    }

    const sessions = Array.from(sessionsMap.entries()).map(([sessionId, evts]) => {
      const sorted = evts.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const first = sorted[0] as any;
      const last = sorted[sorted.length - 1] as any;
      const completed = sorted.some((e: any) => e.event === 'QUOTE_COMPLETED');
      const abandoned = sorted.some((e: any) => e.event === 'QUOTE_ABANDONED');
      const routeEvent = sorted.find((e: any) => e.event === 'QUOTE_ROUTE_SELECTED');
      const lastStep = [...sorted].reverse().find((e: any) => e.step?.stepNumber);
      // Use the QUOTE_COMPLETED event that carries quoteNumber/isRecurring (sent after PDF generation)
      const completedEvt = [...sorted].reverse().find((e: any) => e.event === 'QUOTE_COMPLETED');
      const quoteNumberVal: string | null = completedEvt?.metadata?.quoteNumber || null;
      const isRecurring: boolean | null =
        first.quoteType === 'LASTMILE'
          ? null
          : completedEvt
            ? completedEvt.metadata?.isRecurring !== false
            : true;

      return {
        sessionId,
        quoteType: first.quoteType,
        startedAt: first.timestamp,
        endedAt: last.timestamp,
        status: completed ? 'completed' : abandoned ? 'abandoned' : 'in_progress',
        route: (routeEvent as any)?.route || null,
        lastStep: (lastStep as any)?.step || null,
        eventsCount: sorted.length,
        isRecurring,
        quoteNumber: quoteNumberVal,
      };
    });

    const summary = {
      totalSessions: sessions.length,
      completed: sessions.filter(s => s.status === 'completed').length,
      abandoned: sessions.filter(s => s.status === 'abandoned').length,
      byType: {
        AIR: { started: 0, completed: 0, abandoned: 0 },
        FCL: { started: 0, completed: 0, abandoned: 0 },
        LCL: { started: 0, completed: 0, abandoned: 0 },
        LASTMILE: { started: 0, completed: 0, abandoned: 0 },
      } as Record<string, { started: number; completed: number; abandoned: number }>,
    };

    for (const s of sessions) {
      const t = summary.byType[s.quoteType];
      if (t) {
        t.started++;
        if (s.status === 'completed') t.completed++;
        if (s.status === 'abandoned') t.abandoned++;
      }
    }

    return res.json({ sessions: sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()), summary });
  } catch (error: any) {
    console.error('[behavior-tracking] Error GET client:', error);
    return res.status(500).json({ error: 'Error al obtener datos del cliente' });
  }
});

// GET /api/behavior-tracking/analytics — Aggregated analytics
app.get('/api/behavior-tracking/analytics', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const ejecutivoUser = await User.findOne({ email: currentUser.sub }).populate('ejecutivoId');
    if (!ejecutivoUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let ejecutivoObjectId: any = null;
    if (ejecutivoUser.ejecutivoId) {
      ejecutivoObjectId = (ejecutivoUser.ejecutivoId as any)._id ?? ejecutivoUser.ejecutivoId;
    } else {
      const lookupEmail = String(ejecutivoUser.email).toLowerCase().trim();
      const ej = await Ejecutivo.findOne({ email: lookupEmail });
      if (ej) ejecutivoObjectId = ej._id;
    }

    if (!ejecutivoObjectId) {
      return res.json({ abandonmentByStep: [], abandonmentByType: [], topRoutes: [], completionTrend: [] });
    }

    const clients = await User.find(
      { ejecutivoId: ejecutivoObjectId, username: { $ne: 'Ejecutivo' } },
      { email: 1 }
    );
    const clientEmails = clients.map(c => c.email.toLowerCase());

    if (clientEmails.length === 0) {
      return res.json({
        abandonmentByStep: [],
        abandonmentByType: [],
        topRoutes: [],
        completionTrend: [],
      });
    }

    // Abandonment by step — UNIQUE SESSIONS that ended abandoned (deduped),
    // excluding sessions that also have QUOTE_COMPLETED. Counting raw events
    // would multi-count beforeunload/pagehide/unmount fires.
    const abandonmentByStep = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails } } },
      {
        $group: {
          _id: '$sessionId',
          quoteType: { $first: '$quoteType' },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
          abandonedSteps: {
            $push: {
              $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, '$step.step', null],
            },
          },
        },
      },
      { $match: { hasAbandoned: 1, hasCompleted: 0 } },
      {
        $project: {
          quoteType: 1,
          step: {
            $arrayElemAt: [
              { $filter: { input: '$abandonedSteps', as: 's', cond: { $ne: ['$$s', null] } } },
              0,
            ],
          },
        },
      },
      { $match: { step: { $ne: null } } },
      {
        $group: {
          _id: { quoteType: '$quoteType', step: '$step' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Started/Completed/Abandoned by quote type — UNIQUE SESSIONS
    // (matches the per-session logic used by /clients so totals reconcile).
    const byTypeAgg = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails }, event: { $in: ['QUOTE_STARTED', 'QUOTE_COMPLETED', 'QUOTE_ABANDONED'] } } },
      {
        $group: {
          _id: { sessionId: '$sessionId', quoteType: '$quoteType' },
          hasStarted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_STARTED'] }, 1, 0] } },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.quoteType',
          QUOTE_STARTED: { $sum: '$hasStarted' },
          QUOTE_COMPLETED: { $sum: '$hasCompleted' },
          QUOTE_ABANDONED: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$hasAbandoned', 1] }, { $eq: ['$hasCompleted', 0] }] },
                1, 0,
              ],
            },
          },
        },
      },
    ]);
    // Flatten back to { quoteType, event, count }[] to keep the API shape stable.
    const abandonmentByType: Array<{ _id: { quoteType: string; event: string }; count: number }> = [];
    for (const row of byTypeAgg as any[]) {
      if (!row?._id) continue;
      abandonmentByType.push({ _id: { quoteType: row._id, event: 'QUOTE_STARTED' }, count: row.QUOTE_STARTED || 0 });
      abandonmentByType.push({ _id: { quoteType: row._id, event: 'QUOTE_COMPLETED' }, count: row.QUOTE_COMPLETED || 0 });
      abandonmentByType.push({ _id: { quoteType: row._id, event: 'QUOTE_ABANDONED' }, count: row.QUOTE_ABANDONED || 0 });
    }

    const topRoutes = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails }, event: 'QUOTE_ROUTE_SELECTED', 'route.origin': { $exists: true } } },
      {
        $group: {
          _id: { origin: '$route.origin', destination: '$route.destination', quoteType: '$quoteType' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 0,
          origin: '$_id.origin',
          destination: '$_id.destination',
          quoteType: '$_id.quoteType',
          count: 1,
        },
      },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Completion trend — UNIQUE SESSIONS per (date, event), not raw events.
    const completionTrend = await QuoteTrackingEvent.aggregate([
      {
        $match: {
          clientEmail: { $in: clientEmails },
          event: { $in: ['QUOTE_STARTED', 'QUOTE_COMPLETED', 'QUOTE_ABANDONED'] },
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { sessionId: '$sessionId', event: '$event' },
          timestamp: { $min: '$timestamp' },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            event: '$_id.event',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    return res.json({
      abandonmentByStep: abandonmentByStep.map((a: any) => ({
        quoteType: a._id.quoteType,
        step: a._id.step,
        count: a.count,
      })),
      abandonmentByType: abandonmentByType.map((a: any) => ({
        quoteType: a._id.quoteType,
        event: a._id.event,
        count: a.count,
      })),
      topRoutes,
      completionTrend: completionTrend.map((c: any) => ({
        date: c._id.date,
        event: c._id.event,
        count: c.count,
      })),
    });
  } catch (error: any) {
    console.error('[behavior-tracking] Error GET analytics:', error);
    return res.status(500).json({ error: 'Error al obtener analytics' });
  }
});

// GET /api/behavior-tracking/all-clients — Summary of ALL clients (admin/global)
app.get('/api/behavior-tracking/all-clients', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const clients = await User.find(
      { username: { $ne: 'Ejecutivo' } },
      { email: 1, username: 1, usernames: 1, nombreuser: 1 }
    );

    const clientEmails = clients.map(c => c.email.toLowerCase());
    if (clientEmails.length === 0) {
      return res.json({ clients: [] });
    }

    const behaviorStats = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails } } },
      {
        $group: {
          _id: { email: '$clientEmail', sessionId: '$sessionId' },
          hasStarted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_STARTED'] }, 1, 0] } },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
          lastActivity: { $max: '$timestamp' },
          quoteType: { $first: '$quoteType' },
        },
      },
      {
        $group: {
          _id: '$_id.email',
          totalEvents: { $sum: 1 },
          quotesStarted: { $sum: '$hasStarted' },
          quotesCompleted: { $sum: '$hasCompleted' },
          quotesAbandoned: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$hasAbandoned', 1] }, { $eq: ['$hasCompleted', 0] }] },
                1, 0,
              ],
            },
          },
          lastActivity: { $max: '$lastActivity' },
          quoteTypes: { $addToSet: '$quoteType' },
        },
      },
    ]);

    const statsMap = new Map(behaviorStats.map((s: any) => [s._id, s]));

    const result = clients.map((c) => {
      const stats = statsMap.get(c.email.toLowerCase()) || null;
      return {
        email: c.email,
        username: c.username,
        usernames: c.usernames,
        nombreuser: c.nombreuser,
        stats: stats
          ? {
              totalEvents: stats.totalEvents,
              quotesStarted: stats.quotesStarted,
              quotesCompleted: stats.quotesCompleted,
              quotesAbandoned: stats.quotesAbandoned,
              completionRate:
                stats.quotesStarted > 0
                  ? Math.round((stats.quotesCompleted / stats.quotesStarted) * 100)
                  : 0,
              lastActivity: stats.lastActivity,
              quoteTypes: stats.quoteTypes,
            }
          : null,
      };
    });

    return res.json({ clients: result });
  } catch (error: any) {
    console.error('[behavior-tracking] Error GET all-clients:', error);
    return res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/behavior-tracking/all-analytics — Aggregated analytics across ALL clients
app.get('/api/behavior-tracking/all-analytics', auth, async (req, res) => {
  try {
    const currentUser = (req as any).user as AuthPayload;
    if (currentUser.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const clients = await User.find(
      { username: { $ne: 'Ejecutivo' } },
      { email: 1 }
    );
    const clientEmails = clients.map(c => c.email.toLowerCase());

    if (clientEmails.length === 0) {
      return res.json({
        abandonmentByStep: [],
        abandonmentByType: [],
        topRoutes: [],
        completionTrend: [],
      });
    }

    // Abandonment by step — UNIQUE SESSIONS that ended abandoned (deduped).
    const abandonmentByStep = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails } } },
      {
        $group: {
          _id: '$sessionId',
          quoteType: { $first: '$quoteType' },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
          abandonedSteps: {
            $push: {
              $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, '$step.step', null],
            },
          },
        },
      },
      { $match: { hasAbandoned: 1, hasCompleted: 0 } },
      {
        $project: {
          quoteType: 1,
          step: {
            $arrayElemAt: [
              { $filter: { input: '$abandonedSteps', as: 's', cond: { $ne: ['$$s', null] } } },
              0,
            ],
          },
        },
      },
      { $match: { step: { $ne: null } } },
      {
        $group: {
          _id: { quoteType: '$quoteType', step: '$step' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Started/Completed/Abandoned by quote type — UNIQUE SESSIONS.
    const byTypeAggAll = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails }, event: { $in: ['QUOTE_STARTED', 'QUOTE_COMPLETED', 'QUOTE_ABANDONED'] } } },
      {
        $group: {
          _id: { sessionId: '$sessionId', quoteType: '$quoteType' },
          hasStarted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_STARTED'] }, 1, 0] } },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          hasAbandoned: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_ABANDONED'] }, 1, 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.quoteType',
          QUOTE_STARTED: { $sum: '$hasStarted' },
          QUOTE_COMPLETED: { $sum: '$hasCompleted' },
          QUOTE_ABANDONED: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$hasAbandoned', 1] }, { $eq: ['$hasCompleted', 0] }] },
                1, 0,
              ],
            },
          },
        },
      },
    ]);
    const abandonmentByType: Array<{ _id: { quoteType: string; event: string }; count: number }> = [];
    for (const row of byTypeAggAll as any[]) {
      if (!row?._id) continue;
      abandonmentByType.push({ _id: { quoteType: row._id, event: 'QUOTE_STARTED' }, count: row.QUOTE_STARTED || 0 });
      abandonmentByType.push({ _id: { quoteType: row._id, event: 'QUOTE_COMPLETED' }, count: row.QUOTE_COMPLETED || 0 });
      abandonmentByType.push({ _id: { quoteType: row._id, event: 'QUOTE_ABANDONED' }, count: row.QUOTE_ABANDONED || 0 });
    }

    const topRoutes = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: clientEmails }, event: 'QUOTE_ROUTE_SELECTED', 'route.origin': { $exists: true } } },
      {
        $group: {
          _id: { origin: '$route.origin', destination: '$route.destination', quoteType: '$quoteType' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 0,
          origin: '$_id.origin',
          destination: '$_id.destination',
          quoteType: '$_id.quoteType',
          count: 1,
        },
      },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Completion trend — UNIQUE SESSIONS per (date, event).
    const completionTrend = await QuoteTrackingEvent.aggregate([
      {
        $match: {
          clientEmail: { $in: clientEmails },
          event: { $in: ['QUOTE_STARTED', 'QUOTE_COMPLETED', 'QUOTE_ABANDONED'] },
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { sessionId: '$sessionId', event: '$event' },
          timestamp: { $min: '$timestamp' },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            event: '$_id.event',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    return res.json({
      abandonmentByStep: abandonmentByStep.map((a: any) => ({
        quoteType: a._id.quoteType,
        step: a._id.step,
        count: a.count,
      })),
      abandonmentByType: abandonmentByType.map((a: any) => ({
        quoteType: a._id.quoteType,
        event: a._id.event,
        count: a.count,
      })),
      topRoutes,
      completionTrend: completionTrend.map((c: any) => ({
        date: c._id.date,
        event: c._id.event,
        count: c.count,
      })),
    });
  } catch (error: any) {
    console.error('[behavior-tracking] Error GET all-analytics:', error);
    return res.status(500).json({ error: 'Error al obtener analytics' });
  }
});

// GET /api/behavior-tracking/temperature — frío/tibio/caliente/más abandonos
// (?scope=admin para incluir TODOS los clientes del portal)
app.get('/api/behavior-tracking/temperature', auth, async (req, res) => {
  try {
    const decoded = (req as any).user as AuthPayload;
    if (decoded.username !== 'Ejecutivo') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const scope = String(req.query?.scope || 'ejecutivo').toLowerCase();
    const userMatch: Record<string, unknown> = { username: { $ne: 'Ejecutivo' } };

    if (scope !== 'admin') {
      const ejecutivoUser = await User.findOne({ email: decoded.sub }).populate('ejecutivoId');
      if (!ejecutivoUser) return res.status(404).json({ error: 'Usuario no encontrado' });
      let ejecutivoObjectId: any = null;
      if (ejecutivoUser.ejecutivoId) {
        ejecutivoObjectId = (ejecutivoUser.ejecutivoId as any)._id ?? ejecutivoUser.ejecutivoId;
      } else {
        const ej = await Ejecutivo.findOne({ email: String(ejecutivoUser.email).toLowerCase().trim() });
        if (ej) ejecutivoObjectId = ej._id;
      }
      if (!ejecutivoObjectId) {
        return res.json({ counts: { frio: 0, tibio: 0, caliente: 0, masAbandonos: 0 }, lists: { frio: [], tibio: [], caliente: [], masAbandonos: [] } });
      }
      userMatch.ejecutivoId = ejecutivoObjectId;
    }

    const dbUsers = await User.find(userMatch, { email: 1, username: 1, usernames: 1, nombreuser: 1, createdAt: 1, ejecutivoId: 1 }).populate('ejecutivoId').lean();

    const inputs: TemperatureUserInput[] = dbUsers.map((u: any) => ({
      email: u.email,
      username: u.username,
      usernames: u.usernames,
      nombreuser: u.nombreuser,
      createdAt: u.createdAt,
      ejecutivoEmail: u.ejecutivoId?.email ? String(u.ejecutivoId.email).toLowerCase().trim() : null,
    }));

    const records = await buildClientTemperatureRecords(inputs);
    const summary = summarizeTemperature(records);

    const myRecords = records.filter(
      (r) => r.ejecutivoEmail === String(decoded.sub).toLowerCase().trim(),
    );
    void emitColdClientNotifications(myRecords);

    return res.json(summary);
  } catch (error: any) {
    console.error('[behavior-tracking] Error GET temperature:', error);
    return res.status(500).json({ error: 'Error al calcular temperatura de clientes' });
  }
});

// ============================================================
// RUTAS DE ALERTAS DE PRICING
// ============================================================

// GET /api/pricing/expiry-check?days=7
app.get('/api/pricing/expiry-check', auth, async (req: any, res: any) => {
  try {
    const ejDoc = await Ejecutivo.findOne({ email: req.user.sub.toLowerCase() });
    if (!ejDoc?.roles?.administrador && !ejDoc?.roles?.pricing) {
      return res.status(403).json({ error: 'No tienes permisos para ver alertas de pricing' });
    }

    const daysParam = parseInt(String(req.query?.days || '7'));
    const days = isNaN(daysParam) || daysParam < 1 ? 7 : Math.min(daysParam, 30);

    const { air, fcl, lcl } = await fetchAllExpiring(days);

    return res.json({
      success: true,
      days,
      air,
      fcl,
      lcl,
      totals: { air: air.length, fcl: fcl.length, lcl: lcl.length, all: air.length + fcl.length + lcl.length },
    });
  } catch (e: any) {
    console.error('[pricing/expiry-check] Error:', e);
    return res.status(500).json({ error: 'Error al verificar tarifas' });
  }
});

// POST /api/pricing/send-alerts — envío manual (solo administrador)
app.post('/api/pricing/send-alerts', auth, async (req: any, res: any) => {
  try {
    const ejDoc = await Ejecutivo.findOne({ email: req.user.sub.toLowerCase() });
    if (!ejDoc?.roles?.administrador) {
      return res.status(403).json({ error: 'Solo los administradores pueden enviar alertas manualmente' });
    }

    const body = req.body || {};
    const alertType: PricingAlertType = body.alertType === '24hrs' ? '24hrs' : '48hrs';
    const tariffType: 'air' | 'fcl' | 'lcl' =
      body.tariffType === 'fcl' ? 'fcl' : body.tariffType === 'lcl' ? 'lcl' : 'air';
    const extraEmailsRaw: unknown = body.extraEmails;
    const onlyExtra: boolean = body.onlyExtraEmails === true;

    const extraEmails: string[] = [];
    if (Array.isArray(extraEmailsRaw)) {
      for (const e of extraEmailsRaw) {
        const clean = String(e || '').toLowerCase().trim();
        if (clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) extraEmails.push(clean);
      }
    }

    // Manual send uses inclusive window (0..windowDays days), so tariffs
    // expiring TODAY (daysUntilExpiry=0) are also caught alongside tomorrow's.
    const windowDays = alertType === '24hrs' ? 1 : 2;
    const { air, fcl, lcl } = await fetchAllExpiring(windowDays);
    const airFiltered = tariffType === 'air' ? filterMaxWindow(air, windowDays) : [];
    const fclFiltered = tariffType === 'fcl' ? filterMaxWindow(fcl, windowDays) : [];
    const lclFiltered = tariffType === 'lcl' ? filterMaxWindow(lcl, windowDays) : [];

    let recipients: { email: string; name?: string }[] = [];
    if (!onlyExtra) {
      const pricingUsers = await Ejecutivo.find({ activo: true, 'roles.pricing': true })
        .select('email nombre')
        .lean<{ email: string; nombre?: string }[]>();
      recipients = pricingUsers
        .filter((u) => u.email)
        .map((u) => ({ email: String(u.email).toLowerCase().trim(), name: u.nombre || undefined }));
    }
    for (const em of extraEmails) {
      if (!recipients.some((r) => r.email === em)) recipients.push({ email: em });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No hay destinatarios' });
    }

    const BREVO_SENDER = { name: 'Seemann Cloud · Pricing', email: 'noreply@sphereglobal.io' };
    const sent: { type: string; count: number }[] = [];

    async function sendAlert(subject: string, html: string, type: string) {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: BREVO_SENDER, to: recipients, subject, htmlContent: html }),
      });
      if (!r.ok) console.error(`[pricing/send-alerts] Error Brevo (${type}):`, await r.text());
      else sent.push({ type, count: recipients.length });
    }

    if (airFiltered.length > 0)
      await sendAlert(buildAirExpiryAlertSubject(alertType, airFiltered.length), buildAirExpiryAlertHTML(airFiltered, alertType), 'AIR');
    if (fclFiltered.length > 0)
      await sendAlert(buildFCLExpiryAlertSubject(alertType, fclFiltered.length), buildFCLExpiryAlertHTML(fclFiltered, alertType), 'FCL');
    if (lclFiltered.length > 0)
      await sendAlert(buildLCLExpiryAlertSubject(alertType, lclFiltered.length), buildLCLExpiryAlertHTML(lclFiltered, alertType), 'LCL');

    const noData = airFiltered.length === 0 && fclFiltered.length === 0 && lclFiltered.length === 0;

    return res.json({
      success: true,
      alertType,
      recipients: recipients.map((r) => r.email),
      sent,
      expiring: { air: airFiltered.length, fcl: fclFiltered.length, lcl: lclFiltered.length },
      message: noData
        ? `No hay tarifas que venzan en la ventana de ${alertType}. No se enviaron correos.`
        : 'Alertas enviadas correctamente.',
    });
  } catch (e: any) {
    console.error('[pricing/send-alerts] Error:', e);
    return res.status(500).json({ error: 'Error al enviar alertas' });
  }
});

/** =========================
 *  Start
 *  ========================= */
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`🚀 Auth server: http://localhost:${PORT}`);
});
