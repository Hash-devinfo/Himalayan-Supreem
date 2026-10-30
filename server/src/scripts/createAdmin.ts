import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB, disconnectDB } from '../config/db.js';
import Admin from '../models/Admin.js';

const adminInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .max(72, 'Password must be at most 72 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Lets us hide what's typed for password questions.
let muted = false;
const output = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });

async function ask(question: string): Promise<string> {
  return rl.question(question);
}

async function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  muted = true;
  const answer = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  return answer;
}

async function main(): Promise<void> {
  await connectDB();

  const existingCount = await Admin.countDocuments();
  if (existingCount > 0) {
    console.error('\nAn admin account already exists. Only one admin is allowed at launch.');
    rl.close();
    await disconnectDB();
    process.exit(1);
  }

  console.log('\nCreate the store admin account\n');

  const input = {
    name: await ask('Name: '),
    email: await ask('Email: '),
    password: await askHidden('Password (min 12 characters, hidden): '),
    confirmPassword: await askHidden('Confirm password: '),
  };
  rl.close();

  const result = adminInputSchema.safeParse(input);
  if (!result.success) {
    console.error('\nPlease fix the following:');
    for (const issue of result.error.issues) {
      console.error(`- ${issue.message}`);
    }
    await disconnectDB();
    process.exit(1);
  }
  const { name, email, password } = result.data;

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.create({ name, email, passwordHash });

  console.log(`\nAdmin created: ${admin.name} <${admin.email}>`);
  await disconnectDB();
}
main().catch(async (error: unknown) => {
  console.error('Failed to create admin:', error);
  await disconnectDB();
  process.exit(1);
});