import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;

// Bucket exclusivo para cotizaciones México (JSON + PDF)
const R2_BUCKET_MEXICO =
  process.env.R2_BUCKET_MEXICO || process.env.R2_BUCKET_QUOTES_MEXICO;

if (!R2_BUCKET_MEXICO) {
  throw new Error(
    "Missing env var: R2_BUCKET_MEXICO (or R2_BUCKET_QUOTES_MEXICO)",
  );
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function safeSegment(value: string): string {
  // Mantener el path estable y sin caracteres raros
  return encodeURIComponent(String(value).trim());
}

export function buildMexicoQuoteJsonKey(
  ownerUsername: string,
  quoteNumber: string,
): string {
  const safeOwner = safeSegment(ownerUsername);
  const safeQuote = encodeURIComponent(String(quoteNumber));
  return `quotes/${safeOwner}/${safeQuote}.json`;
}

export function buildMexicoQuotePdfKey(
  ownerUsername: string,
  quoteNumber: string,
): string {
  const safeOwner = safeSegment(ownerUsername);
  const safeQuote = encodeURIComponent(String(quoteNumber));
  return `quotes/${safeOwner}/${safeQuote}.pdf`;
}

// Legacy (antes de separar por consignee)
function buildLegacyJsonKey(quoteNumber: string): string {
  const safeQuote = encodeURIComponent(String(quoteNumber));
  return `quotes/${safeQuote}.json`;
}
function buildLegacyPdfKey(quoteNumber: string): string {
  const safeQuote = encodeURIComponent(String(quoteNumber));
  return `quotes/${safeQuote}.pdf`;
}

async function streamToBuffer(body: any): Promise<Buffer> {
  if (!body) throw new Error("R2 response body is empty");

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  const reader = body.getReader?.();
  if (!reader) {
    throw new Error("Unsupported R2 body type");
  }

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function putMexicoQuoteJson(
  ownerUsername: string,
  quoteNumber: string,
  json: unknown,
  metadata?: Record<string, string>,
): Promise<{ key: string; bytes: number }> {
  const key = buildMexicoQuoteJsonKey(ownerUsername, quoteNumber);
  const body = Buffer.from(JSON.stringify(json), "utf8");

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_MEXICO,
      Key: key,
      Body: body,
      ContentType: "application/json",
      Metadata: metadata,
    }),
  );

  return { key, bytes: body.byteLength };
}

export async function getMexicoQuoteJsonBuffer(
  ownerUsername: string,
  quoteNumber: string,
): Promise<Buffer> {
  const key = buildMexicoQuoteJsonKey(ownerUsername, quoteNumber);
  try {
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: key,
      }),
    );
    return streamToBuffer(res.Body);
  } catch {
    // fallback legacy
    const legacyKey = buildLegacyJsonKey(quoteNumber);
    const resLegacy = await s3Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: legacyKey,
      }),
    );
    return streamToBuffer(resLegacy.Body);
  }
}

export async function putMexicoQuotePdf(
  ownerUsername: string,
  quoteNumber: string,
  pdfBuffer: Buffer,
  metadata?: Record<string, string>,
): Promise<{ key: string; bytes: number }> {
  const key = buildMexicoQuotePdfKey(ownerUsername, quoteNumber);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_MEXICO,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      Metadata: metadata,
    }),
  );
  return { key, bytes: pdfBuffer.byteLength };
}

export async function getMexicoQuotePdfBuffer(
  ownerUsername: string,
  quoteNumber: string,
): Promise<Buffer> {
  const key = buildMexicoQuotePdfKey(ownerUsername, quoteNumber);
  try {
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: key,
      }),
    );
    return streamToBuffer(res.Body);
  } catch {
    // fallback legacy
    const legacyKey = buildLegacyPdfKey(quoteNumber);
    const resLegacy = await s3Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: legacyKey,
      }),
    );
    return streamToBuffer(resLegacy.Body);
  }
}

export async function mexicoQuotePdfExists(
  ownerUsername: string,
  quoteNumber: string,
): Promise<boolean> {
  const key = buildMexicoQuotePdfKey(ownerUsername, quoteNumber);
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: key,
      }),
    );
    return true;
  } catch {
    // fallback legacy
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET_MEXICO,
          Key: buildLegacyPdfKey(quoteNumber),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

