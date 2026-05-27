import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

export async function getMongoDb(uri: string, dbName?: string) {
  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
    });
    await client.connect();
  }

  const inferredDbName =
    dbName ||
    (() => {
      try {
        const parsed = new URL(uri);
        const name = parsed.pathname?.replace(/^\//, '') || '';
        return name || undefined;
      } catch {
        return undefined;
      }
    })();

  if (!inferredDbName) {
    throw new Error(
      'No se pudo inferir el nombre de la base de datos desde MONGODB_URI. Define WHATSAPP_MONGODB_DB.',
    );
  }

  return client.db(inferredDbName);
}

