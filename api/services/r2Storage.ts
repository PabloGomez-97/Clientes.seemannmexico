import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'seemann-quotepdfs';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g. https://pub-7ac1....r2.dev

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Build the R2 object key for a quote PDF.
 * Pattern: {usuarioId}/{quoteNumber}.pdf
 */
export function buildR2Key(usuarioId: string, quoteNumber: string): string {
  const safeUser = encodeURIComponent(usuarioId);
  const safeQuote = encodeURIComponent(quoteNumber);
  return `${safeUser}/${safeQuote}.pdf`;
}

/**
 * Get the public download URL for a stored PDF.
 */
export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Upload a PDF (as a Buffer) to R2.
 */
export async function uploadPDF(
  key: string,
  pdfBuffer: Buffer,
  metadata?: Record<string, string>,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: metadata,
    }),
  );
}

/**
 * Check if a PDF exists in R2.
 */
export async function pdfExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a single PDF from R2.
 */
export async function deletePDF(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

/**
 * Delete all PDFs for a given user (by prefix).
 */
export async function deleteAllUserPDFs(usuarioId: string): Promise<number> {  const prefix = `${encodeURIComponent(usuarioId)}/`;
  let deletedCount = 0;
  let continuationToken: string | undefined;

  do {
    const listRes = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = listRes.Contents;
    if (!objects || objects.length === 0) break;

    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key })),
        },
      }),
    );

    deletedCount += objects.length;
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);

  return deletedCount;
}

/**
 * Download a PDF from R2 and return it as a Buffer.
 * This is used server-side to proxy downloads to the frontend,
 * avoiding browser CORS restrictions with the public R2 URL.
 */
export async function downloadPDFBuffer(key: string): Promise<Buffer> {
  const res = await s3Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );

  const body = res.Body;
  if (!body) throw new Error('R2 response body is empty');

  // Body is a ReadableStream (Web Streams API) in Node 18+ or a Readable in older Node
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // Web Streams API (Node 18+)
  const reader = (body as any).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
