// "+923001234567" -> "0300 1234567" (how Pakistani numbers are usually written)
export function displayPkMobile(value?: string): string {
  if (!value) return '';
  const match = value.match(/^\+92(3\d{2})(\d{7})$/);
  return match ? `0${match[1]} ${match[2]}` : value;
}

// A quick check before sending; the server does the full check and stores +923XXXXXXXXX
export function looksLikePkMobile(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return /^(0|92)?3\d{9}$/.test(digits);
}