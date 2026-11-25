/**
 * #108/#113: Name rule for components and diagrams. Mirrors backend/src/Sidebar/nameRules.ts so forms can
 * react early with the same rule; the server stays authoritative.
 */

/** Names the app itself used to generate before #113. They describe nothing and make lists indistinguishable. */
export const PLACEHOLDER_NAMES = ["Neue Komponente", "Neues Diagramm"] as const;

const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9";

/**
 * Removes a trailing number like "2" or "(3)". A single backward scan instead of a regex such as
 * `/\(?\d+\)?$/`, which retries every start position and is quadratic on long digit runs (ReDoS).
 */
function withoutTrailingNumber(key: string): string {
  const end = key.endsWith(")") ? key.length - 1 : key.length;
  let start = end;
  while (isDigit(key[start - 1])) start--;
  if (start === end) return key;
  return key.slice(0, key[start - 1] === "(" ? start - 1 : start);
}

const placeholderKey = (name: string): string =>
  withoutTrailingNumber(name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("de-DE"));

const PLACEHOLDER_KEYS = new Set<string>(PLACEHOLDER_NAMES.map(placeholderKey));

/** "Neue Komponente", "neue  komponente 2" or "Neues Diagramm (3)" count as placeholders. */
export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_KEYS.has(placeholderKey(name));
}

/** Blocking error: an empty or whitespace-only name can never be saved. */
export function elementNameError(value: string): string | null {
  return value.trim() ? null : "Bitte einen Namen eingeben. Ein leerer Name oder nur Leerzeichen sind nicht erlaubt.";
}

/**
 * Non-blocking warning for a placeholder name; saving it needs a second confirmation. With `previousName`
 * (an update), an unchanged legacy placeholder needs no new confirmation.
 */
export function placeholderWarning(value: string, previousName?: string): string | null {
  const name = value.trim();
  if (!name || !isPlaceholderName(name)) return null;
  if (previousName !== undefined && previousName.trim() === name) return null;
  return `„${name}“ ist ein Platzhaltername. Andere finden das Element damit später kaum wieder.`;
}

/** Question shown after the first confirmation; the caller adds how to confirm a second time. */
export function placeholderQuestion(value: string): string {
  return `Wirklich den Platzhalternamen „${value.trim()}“ verwenden?`;
}
