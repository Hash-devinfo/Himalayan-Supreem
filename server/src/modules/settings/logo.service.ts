import Setting, { SETTINGS_ID } from '../../models/Setting.js';
import { deleteImage, uploadImage } from '../../providers/storage/cloudinary.js';
import AppError from '../../utils/AppError.js';
import { formatPkMobile } from '../../utils/phone.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { assertPhoto } from '../media/imageFile.js';
import { getSettings } from './settings.service.js';

// The store logo (requirements 4.5). The business supplies it; nothing is invented.
export const MAX_LOGO_MB = 2;

export async function setLogo(file: Express.Multer.File | undefined, actor: ActorContext) {
  const bytes = assertPhoto(file);
  const settings = await getSettings();
  const old = settings.store.logo?.publicId;

  const stored = await uploadImage(bytes, { folder: 'store', largeWidth: 600, thumbWidth: 200 });
  const logo = { url: stored.url, thumbUrl: stored.thumbUrl, publicId: stored.publicId, width: stored.width, height: stored.height };
  await Setting.updateOne({ _id: SETTINGS_ID }, { $set: { 'store.logo': logo } });
  if (old) await deleteImage(old); // the old logo is no longer used

  await recordAudit({ admin: actor.adminId, action: 'settings.logo_set', entityType: 'Setting', before: { publicId: old }, after: { publicId: stored.publicId, width: stored.width, height: stored.height }, ip: actor.ip });
  return { logo };
}

export async function removeLogo(actor: ActorContext) {
  const settings = await getSettings();
  const old = settings.store.logo?.publicId;
  if (!old) throw new AppError('There is no logo to remove', 404);

  await Setting.updateOne({ _id: SETTINGS_ID }, { $unset: { 'store.logo': '' } });
  await deleteImage(old);
  await recordAudit({ admin: actor.adminId, action: 'settings.logo_remove', entityType: 'Setting', before: { publicId: old }, ip: actor.ip });
  return { logo: null };
}

// Public: what the website header, footer and contact links need. Nothing private.
export async function publicStoreInfo() {
  const { store } = await getSettings();
  return {
    name: store.name,
    logo: store.logo ? { url: store.logo.url, thumbUrl: store.logo.thumbUrl, width: store.logo.width, height: store.logo.height } : null,
    email: store.email ?? null,
    whatsappNumber: store.whatsappNumber ? formatPkMobile(store.whatsappNumber) : null,
    whatsappLink: store.whatsappNumber ? `https://wa.me/${store.whatsappNumber.replace('+', '')}` : null,
    supportHours: store.supportHours ?? null,
  };
}