// Sets a new password for the admin, when the old one is forgotten.
// Runs only on a machine that has the .env (database access), so it is as safe as the database itself.
// Run: npm run reset-admin-password
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB, disconnectDB } from '../config/db.js';
import Admin from '../models/Admin.js';
import AuditLog from '../models/AuditLog.js';

const inputSchema = z
  .object({
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

// Hides what's typed for password questions (same as createAdmin)
let muted = false;
const output = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });

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
  console.log('\nReset the admin password\n');

  const input = {
    email: await rl.question('Admin email: '),
    password: await askHidden('New password (min 12 characters, hidden): '),
    confirmPassword: await askHidden('Confirm new password: '),
  };
  rl.close();

  const result = inputSchema.safeParse(input);
  if (!result.success) {
    console.error('\nPlease fix the following:');
    for (const issue of result.error.issues) console.error(`- ${issue.message}`);
    await disconnectDB();
    process.exit(1);
  }

  const admin = await Admin.findOne({ email: result.data.email });
  if (!admin) {
    console.error(`\nNo admin with the email ${result.data.email}`);
    await disconnectDB();
    process.exit(1);
  }

  admin.passwordHash = await bcrypt.hash(result.data.password, 12);
  admin.passwordChangedAt = new Date(); // logins made with the old password stop working
  admin.failedLoginCount = 0; // a lock from wrong attempts is lifted
  admin.lockUntil = undefined;
  await admin.save();

  await AuditLog.create({
    admin: admin._id,
    action: 'admin.password_reset',
    entityType: 'Admin',
    entityId: admin._id,
    after: { via: 'reset-admin-password script' },
  });

  console.log(`\nPassword changed for ${admin.name} <${admin.email}>. You can log in with the new password now.`);
  await disconnectDB();
}

main().catch(async (error: unknown) => {
  console.error('Failed to reset the password:', error);
  await disconnectDB();
  process.exit(1);
});