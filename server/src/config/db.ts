import mongoose from 'mongoose';
import env from './env.js';

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

export async function connectDB(): Promise<void> {
  try {
    
    const conn = await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB connected: ${conn.connection.host} / database: ${conn.connection.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB connection failed: ${message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
}


export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
}