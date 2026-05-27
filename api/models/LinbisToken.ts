// api/models/LinbisToken.ts
import mongoose from 'mongoose';

interface ILinbisToken {
  _id: string;
  refresh_token: string;
  access_token?: string;
  access_token_expiry?: number;
  updated_at: Date;
}

const LinbisTokenSchema = new mongoose.Schema<ILinbisToken>({
  _id: { type: String, required: true, default: 'linbis_token' },
  refresh_token: { type: String, required: true },
  access_token: { type: String },
  access_token_expiry: { type: Number },
  updated_at: { type: Date, default: Date.now }
});

export const LinbisToken = mongoose.models.LinbisToken || 
  mongoose.model<ILinbisToken>('LinbisToken', LinbisTokenSchema);

export type { ILinbisToken };