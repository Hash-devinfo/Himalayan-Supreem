import Setting, { SETTINGS_ID, type SettingDocument } from '../../models/Setting.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { UpdateSettingsInput } from './settings.validation.js';

// Reads the settings, creating them with defaults the first time.
export async function getSettings(): Promise<SettingDocument> {
  const settings = await Setting.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $setOnInsert: { _id: SETTINGS_ID } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return settings;
}

export async function updateSettings(input: UpdateSettingsInput, actor: ActorContext): Promise<SettingDocument> {
  const settings = await getSettings();

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // Store details: compare field by field (store.name, store.email, ...)
  if (input.store) {
    for (const [key, value] of Object.entries(input.store)) {
      if (value === undefined) continue;
      const current = settings.store[key as keyof typeof settings.store];
      if (current !== value) {
        before[`store.${key}`] = current ?? null;
        after[`store.${key}`] = value;
        settings.set(`store.${key}`, value);
      }
    }
  }

  for (const key of ['orderPrefix', 'freeDeliveryThreshold', 'defaultPackagingCost'] as const) {
    const value = input[key];
    if (value === undefined) continue;
    const current = settings[key];
    // null means "turn off": remove the value
    if (value === null) {
      if (current !== undefined) {
        before[key] = current;
        after[key] = null;
        settings.set(key, undefined);
      }
    } else if (current !== value) {
      before[key] = current ?? null;
      after[key] = value;
      settings.set(key, value);
    }
  }

  if (Object.keys(after).length === 0) {
    return settings;
  }

  await settings.save();

  await recordAudit({
    admin: actor.adminId,
    action: 'settings.update',
    entityType: 'Setting',
    before,
    after,
    ip: actor.ip,
  });

  return settings;
}