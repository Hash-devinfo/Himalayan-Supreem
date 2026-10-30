import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error('Check your .env file (copy it from .env.example).');
    process.exit(1);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrls: required('CLIENT_URL').split(',').map((url) => url.trim()),
  mongoUri: required('MONGO_URI'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
} as const;

export default env;