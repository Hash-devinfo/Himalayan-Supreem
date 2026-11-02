// Tidies a city for display: "  rawalpindi   cantt " -> "Rawalpindi Cantt", "d.i. khan" -> "D.I. Khan"
// Capitalises the first letter, and any letter after a space, "." or "-".
export function tidyCityName(city: string): string {
  return city
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s.-])([a-z])/g, (_match, before: string, letter: string) => before + letter.toUpperCase());
}