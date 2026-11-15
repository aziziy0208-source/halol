/**
 * Certificate number pattern. `{YYYY}` = year, `{YY}` = two-digit year, `{N…}` = the
 * yearly running number padded to the number of N's. Stored in Setting
 * "certificate.numberFormat"; this is the default — WHU's own numbering, as on its
 * certificates (e.g. "H-202026.0021-1").
 */
export const DEFAULT_NUMBER_FORMAT = "H-2020{YY}.{NNNN}-1";

export function formatCertificateNumber(
  year: number,
  sequence: number,
  pattern: string = DEFAULT_NUMBER_FORMAT,
): string {
  return pattern
    .replace("{YYYY}", String(year))
    .replace("{YY}", String(year % 100).padStart(2, "0"))
    .replace(/\{(N+)\}/, (_match, ns: string) => String(sequence).padStart(ns.length, "0"));
}

/**
 * A format must contain exactly one year ({YYYY} or {YY}) and one {N…} (3–8 digits);
 * other characters: letters, digits, - / _ .
 */
export function isValidNumberFormat(pattern: string): boolean {
  if (pattern.length > 40) return false;
  const years = pattern.match(/\{YYYY\}|\{YY\}/g) ?? [];
  if (years.length !== 1) return false;
  const seq = pattern.match(/\{(N+)\}/g);
  if (!seq || seq.length !== 1 || seq[0]!.length - 2 < 3 || seq[0]!.length - 2 > 8) return false;
  const rest = pattern.replace(/\{YYYY\}|\{YY\}/, "").replace(/\{N+\}/, "");
  return /^[A-Za-z0-9\-/_.]*$/.test(rest);
}

/** Parses a number written in `pattern` back into year and sequence (null if it doesn't match). */
export function parseCertificateNumber(
  number: string,
  pattern: string = DEFAULT_NUMBER_FORMAT,
): { year: number; sequence: number } | null {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^${escaped
      .replace("\\{YYYY\\}", "(?<year>\\d{4})")
      .replace("\\{YY\\}", "(?<yy>\\d{2})")
      .replace(/\\\{N+\\\}/, "(?<seq>\\d+)")}$`,
  );
  const match = number.match(regex);
  if (!match?.groups) return null;
  const year = match.groups.year ? Number(match.groups.year) : 2000 + Number(match.groups.yy);
  return { year, sequence: Number(match.groups.seq) };
}
