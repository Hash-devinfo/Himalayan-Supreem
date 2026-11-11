import { Schema, model } from 'mongoose';

// Sequence numbers. _id names the sequence, e.g. "order-261112" = orders placed on 12 Nov 2026 (Pakistan date).
export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

const Counter = model<ICounter>('Counter', counterSchema);

export default Counter;