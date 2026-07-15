import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  return trimmed || undefined;
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;

/** Bucket de documentos Seemann México (nunca el bucket genérico Chile). */
const R2_BUCKET_DOCUMENTS =
  cleanEnv(process.env.R2_BUCKET_DOCUMENTS_MEXICO) ||
  cleanEnv(process.env.R2_BUCKET_DOCUMENTS) ||
  'seemanndocumentsmexico';

const R2_PUBLIC_DOCUMENTS =
  cleanEnv(process.env.R2_PUBLIC_DOCUMENTS_MEXICO) ||
  cleanEnv(process.env.R2_PUBLIC_DOCUMENTS);

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Build the R2 object key for a document.
 * Pattern: {prefix}/{usuarioId}/{parentId}/{docId}_{nombreArchivo}
 */
export function buildDocR2Key(
  prefix: string,
  usuarioId: string,
  parentId: string,
  docId: string,
  nombreArchivo: string,
): string {
  return `${encodeURIComponent(prefix)}/${encodeURIComponent(usuarioId)}/${encodeURIComponent(parentId)}/${docId}_${encodeURIComponent(nombreArchivo)}`;
}

/** Public URL helper (downloads normalmente van por proxy API). */
export function getPublicDocumentUrl(key: string): string | null {
  if (!R2_PUBLIC_DOCUMENTS) return null;
  return `${R2_PUBLIC_DOCUMENTS.replace(/\/$/, '')}/${key}`;
}

export function getDocumentsBucketName(): string {
  return R2_BUCKET_DOCUMENTS;
}

/**
 * Upload a document (as Buffer) to R2 México.
 */
export async function uploadDocument(
  key: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_DOCUMENTS,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );
}

/**
 * Download a document from R2 and return it as a Buffer.
 */
export async function downloadDocumentBuffer(key: string): Promise<Buffer> {
  const res = await s3Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_DOCUMENTS,
      Key: key,
    }),
  );

  const body = res.Body;
  if (!body) throw new Error('R2 response body is empty');

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  const reader = (body as any).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Delete a single document from R2.
 */
export async function deleteDocument(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_DOCUMENTS,
      Key: key,
    }),
  );
}
