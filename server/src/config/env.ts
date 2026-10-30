import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error("Check your .env file (copy it from .env.example).");
    process.exit(1);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrls: required('CLIENT_URL').split(',').map((url) => url.trim()),
  mongoUri: required('MONGO_URI'),
} as const;

export default env;
