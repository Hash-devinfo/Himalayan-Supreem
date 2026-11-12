import { whatsappDigits } from '../../utils/phone.js';

// Release 1 WhatsApp "provider" (design 1.4): a wa.me link that opens WhatsApp with the
// message already typed. The admin presses Send, so the server can only say "prepared".
// Release 3 replaces this with the WhatsApp Business API, without changing the order code.
export function buildWhatsappLink(phone: string, text: string): string {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(text)}`;
}