// Pakistani mobile numbers.
// Accepts the ways people type them and turns them into one stored form: +923XXXXXXXXX
//   0300 1234567, 03001234567, 300-1234567, +92 300 1234567, 923001234567, 0092 300 1234567

// After removing spaces, dashes, brackets and dots, and the leading 0, +92, 92 or 0092,
// a mobile number is "3" followed by 9 digits.
const MOBILE_CORE = /^3\d{9}$/;

export function normalizePkMobile(input: string): string | null {
  let digits = input.trim().replace(/[\s\-().]/g, '');

  if (digits.startsWith('+92')) digits = digits.slice(3);
  else if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  return MOBILE_CORE.test(digits) ? `+92${digits}` : null;
}

// For showing to people: +923001234567 -> 0300 1234567
export function formatPkMobile(stored: string): string {
  const core = stored.replace(/^\+92/, '');
  return `0${core.slice(0, 3)} ${core.slice(3)}`;
}

// For WhatsApp links (wa.me needs digits only, with country code): +923001234567 -> 923001234567
export function whatsappDigits(stored: string): string {
  return stored.replace(/^\+/, '');
}