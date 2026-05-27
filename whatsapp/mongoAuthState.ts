import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import type { Collection, Db } from 'mongodb';

type BaileysAuthDoc = {
  _id: string; // sessionId
  creds: any;
  keys: Record<string, any>;
  updatedAt: Date;
};

function serialize<T>(value: T): any {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function deserialize<T>(value: any): T {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;
}

function keyId(type: string, id: string): string {
  return `${type}:${id}`;
}

export async function useMongoAuthState(opts: {
  db: Db;
  sessionId: string;
  collectionName?: string;
}): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const collection: Collection<BaileysAuthDoc> = opts.db.collection<BaileysAuthDoc>(
    opts.collectionName || 'baileys_auth',
  );

  const existing = await collection.findOne({ _id: opts.sessionId });
  const creds: AuthenticationCreds = existing?.creds
    ? deserialize<AuthenticationCreds>(existing.creds)
    : initAuthCreds();
  const keys: Record<string, any> = existing?.keys ? deserialize(existing.keys) : {};

  async function persist(): Promise<void> {
    await collection.updateOne(
      { _id: opts.sessionId },
      {
        $set: {
          creds: serialize(creds),
          keys: serialize(keys),
          updatedAt: new Date(),
        },
        $setOnInsert: { _id: opts.sessionId },
      },
      { upsert: true },
    );
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[],
      ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
        const out: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          const k = keyId(String(type), String(id));
          const value = keys[k];
          if (value) {
            out[id] = value as SignalDataTypeMap[T];
          }
        }
        return out;
      },
      set: async (data: any): Promise<void> => {
        for (const type of Object.keys(data || {})) {
          for (const id of Object.keys(data[type] || {})) {
            const value = data[type][id];
            const k = keyId(type, id);
            if (value) keys[k] = value;
            else delete keys[k];
          }
        }
        await persist();
      },
    },
  };

  return {
    state,
    saveCreds: persist,
  };
}

