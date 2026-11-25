import type { Types } from 'mongoose';
import env from '../../../config/env.js';
import IntegrationLog, { INTEGRATION_LOG_DAYS, type IntegrationAction } from '../../../models/IntegrationLog.js';
import AppError from '../../../utils/AppError.js';

// Talks to the PostEx Merchant API (guide: "Merchant API Integration Guide").
// - The token goes in the "token" header and is never logged.
// - Answers look like { statusCode: "200", statusMessage, dist }.
// - Reading calls (GET) are tried again once if PostEx is slow or down; bookings are never
//   repeated automatically, so a parcel can never be booked twice by mistake.
// - Every call is written to IntegrationLog (success or failure).

const TIMEOUT_MS = 15_000;

export interface PostexCall {
  method: 'GET' | 'POST' | 'PUT';
  path: string; // e.g. /services/integration/api/order/v2/get-operational-city
  query?: Record<string, string | undefined>;
  body?: unknown;
  action: IntegrationAction;
  order?: { id: Types.ObjectId; orderNumber: string };
  summary?: string; // what was asked, in a few words (no personal data)
  expect?: 'json' | 'pdf';
}

export interface PostexResult<T> {
  statusCode: string;
  statusMessage: string;
  dist: T;
}

export function isPostexConfigured(): boolean {
  return env.postex !== null;
}

export function postexMode(): 'live' | 'uat' | null {
  return env.postex?.mode ?? null;
}

function requireSettings() {
  if (!env.postex) throw new AppError('PostEx is not set up. Add POSTEX_TOKEN to the server .env file.', 503);
  return env.postex;
}

function short(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function log(call: PostexCall, entry: { status: 'success' | 'failed'; httpStatus?: number; response?: string; error?: string; attempt: number; durationMs: number }) {
  await IntegrationLog.create({
    provider: 'postex',
    action: call.action,
    order: call.order?.id,
    orderNumber: call.order?.orderNumber,
    status: entry.status,
    httpStatus: entry.httpStatus,
    requestSummary: short(`${call.method} ${call.path}${call.summary ? ` (${call.summary})` : ''}`),
    responseSummary: entry.response ? short(entry.response) : undefined,
    error: entry.error ? short(entry.error) : undefined,
    attempt: entry.attempt,
    durationMs: entry.durationMs,
    expiresAt: new Date(Date.now() + INTEGRATION_LOG_DAYS * 24 * 60 * 60 * 1000),
  }).catch((e: unknown) => console.error('Could not write the PostEx log:', (e as Error).message));
}

async function once<T>(call: PostexCall, attempt: number): Promise<PostexResult<T> | Buffer> {
  const settings = requireSettings();
  const url = new URL(call.path, settings.baseUrl);
  for (const [key, value] of Object.entries(call.query ?? {})) if (value !== undefined) url.searchParams.set(key, value);

  const started = Date.now();
  let httpStatus: number | undefined;
  try {
    const response = await fetch(url, {
      method: call.method,
      headers: { token: settings.token, Accept: call.expect === 'pdf' ? 'application/pdf' : 'application/json', ...(call.body ? { 'Content-Type': 'application/json' } : {}) },
      body: call.body ? JSON.stringify(call.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    httpStatus = response.status;

    if (call.expect === 'pdf' && response.ok) {
      const pdf = Buffer.from(await response.arrayBuffer());
      await log(call, { status: 'success', httpStatus, response: `PDF ${pdf.length} bytes`, attempt, durationMs: Date.now() - started });
      return pdf;
    }

    const text = await response.text();
    let parsed: Partial<PostexResult<T>> | undefined;
    try {
      parsed = JSON.parse(text) as Partial<PostexResult<T>>;
    } catch {
      parsed = undefined;
    }
    const ok = response.ok && parsed && String(parsed.statusCode) === '200';
    if (!ok) {
      const reason = parsed?.statusMessage ?? (text ? short(text, 150) : `HTTP ${response.status}`);
      await log(call, { status: 'failed', httpStatus, error: reason, attempt, durationMs: Date.now() - started });
      const auth = response.status === 401 || response.status === 403;
      throw new AppError(auth ? 'PostEx refused the token. Check POSTEX_TOKEN and POSTEX_ENV in .env.' : `PostEx said: ${reason}`, auth ? 502 : response.status >= 500 ? 502 : 400);
    }
    await log(call, { status: 'success', httpStatus, response: `${parsed!.statusCode} ${parsed!.statusMessage ?? ''}`, attempt, durationMs: Date.now() - started });
    return parsed as PostexResult<T>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const reason = (error as Error).name === 'TimeoutError' ? `no answer within ${TIMEOUT_MS / 1000} seconds` : (error as Error).message;
    await log(call, { status: 'failed', httpStatus, error: reason, attempt, durationMs: Date.now() - started });
    throw new AppError(`PostEx could not be reached (${reason}). Please try again in a few minutes.`, 504);
  }
}

export async function postexRequest<T>(call: PostexCall): Promise<PostexResult<T>> {
  try {
    return (await once<T>(call, 1)) as PostexResult<T>;
  } catch (error) {
    // One more try for reading calls when PostEx was down or slow
    const retry = call.method === 'GET' && error instanceof AppError && error.statusCode >= 502;
    if (!retry) throw error;
    return (await once<T>(call, 2)) as PostexResult<T>;
  }
}

export async function postexPdf(call: PostexCall): Promise<Buffer> {
  return (await once<never>({ ...call, expect: 'pdf' }, 1)) as Buffer;
}

// PostEx sometimes sends true/false as text
export function yes(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === 'true';
}