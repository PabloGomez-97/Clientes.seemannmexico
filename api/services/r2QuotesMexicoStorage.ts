import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed || undefined;
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;

// Bucket exclusivo para cotizaciones México (JSON + PDF)
const R2_BUCKET_MEXICO =
  cleanEnv(process.env.R2_BUCKET_MEXICO) ||
  cleanEnv(process.env.R2_BUCKET_QUOTES_MEXICO) ||
  "seemannquotesmexico";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function safeSegment(value: string): string {
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

function buildLegacyJsonKey(quoteNumber: string): string {
  return `quotes/${encodeURIComponent(String(quoteNumber))}.json`;
}

function buildLegacyPdfKey(quoteNumber: string): string {
  return `quotes/${encodeURIComponent(String(quoteNumber))}.pdf`;
}

function isNotFoundError(error: unknown): boolean {
  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e?.name === "NoSuchKey" ||
    e?.name === "NotFound" ||
    e?.Code === "NoSuchKey" ||
    e?.Code === "NotFound" ||
    e?.$metadata?.httpStatusCode === 404
  );
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

async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: key,
      }),
    );
    return streamToBuffer(res.Body);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_MEXICO,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

function jsonKeyCandidates(
  ownerUsername: string,
  quoteNumber: string,
  preferredKey?: string | null,
): string[] {
  const owner = String(ownerUsername || "").trim();
  const number = String(quoteNumber || "").trim();
  return [
    preferredKey || "",
    buildMexicoQuoteJsonKey(owner, number),
    // Sin encode (mismo para alfanuméricos; útil si hay keys crudas)
    `quotes/${owner}/${number}.json`,
    buildLegacyJsonKey(number),
  ].filter((key, index, arr) => Boolean(key) && arr.indexOf(key) === index);
}

function pdfKeyCandidates(
  ownerUsername: string,
  quoteNumber: string,
  preferredKey?: string | null,
): string[] {
  const owner = String(ownerUsername || "").trim();
  const number = String(quoteNumber || "").trim();
  return [
    preferredKey || "",
    buildMexicoQuotePdfKey(owner, number),
    `quotes/${owner}/${number}.pdf`,
    buildLegacyPdfKey(number),
  ].filter((key, index, arr) => Boolean(key) && arr.indexOf(key) === index);
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
  preferredKey?: string | null,
): Promise<Buffer | null> {
  for (const key of jsonKeyCandidates(ownerUsername, quoteNumber, preferredKey)) {
    const buffer = await getObjectBuffer(key);
    if (buffer) return buffer;
  }
  return null;
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
  preferredKey?: string | null,
): Promise<Buffer | null> {
  for (const key of pdfKeyCandidates(ownerUsername, quoteNumber, preferredKey)) {
    const buffer = await getObjectBuffer(key);
    if (buffer) return buffer;
  }
  return null;
}

export async function mexicoQuotePdfExists(
  ownerUsername: string,
  quoteNumber: string,
  preferredKey?: string | null,
): Promise<boolean> {
  for (const key of pdfKeyCandidates(ownerUsername, quoteNumber, preferredKey)) {
    if (await objectExists(key)) return true;
  }
  return false;
}

export async function mexicoQuoteJsonExists(
  ownerUsername: string,
  quoteNumber: string,
  preferredKey?: string | null,
): Promise<boolean> {
  for (const key of jsonKeyCandidates(ownerUsername, quoteNumber, preferredKey)) {
    if (await objectExists(key)) return true;
  }
  return false;
}

export function getMexicoQuotesBucketName(): string {
  return R2_BUCKET_MEXICO;
}
