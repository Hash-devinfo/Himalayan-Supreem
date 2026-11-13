import type { Response } from 'express';

// A CSV file is plain text: one line per row, cells separated by commas.
// Built for Excel and Google Sheets (UTF-8 with BOM, Windows line endings).

// A cell starting with one of these could run as a formula when opened in Excel
// ("CSV injection"), e.g. a product name typed as =HYPERLINK(...). We put ' in front.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  // Commas, quotes or line breaks inside a cell: wrap it in quotes, and double any quotes
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvSection {
  title: string;
  header: string[];
  rows: unknown[][];
}

// Top lines (report name, dates), then each section: a blank line, its title, its header, its rows
export function buildCsv(meta: [string, unknown][], sections: CsvSection[]): string {
  const line = (cells: unknown[]) => cells.map(csvCell).join(',');
  const lines = meta.map(line);

  for (const section of sections) {
    lines.push('', line([section.title]), line(section.header));
    if (section.rows.length === 0) lines.push(line(['(none)']));
    for (const row of section.rows) lines.push(line(row));
  }
  // \uFEFF (the "BOM") tells Excel the file is UTF-8, so Urdu text shows correctly
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function sendCsv(res: Response, file: { filename: string; csv: string }): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'no-store'); // business data: never keep a copy in caches
  res.send(file.csv);
}