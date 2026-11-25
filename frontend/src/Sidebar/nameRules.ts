/**
 * #108/#113: Name rule for components and diagrams. Mirrors backend/src/Sidebar/nameRules.ts so forms can
 * react early with the same rule; the server stays authoritative.
 */

/** Names the app itself used to generate before #113. They describe nothing and make lists indistinguishable. */
export const PLACEHOLDER_NAMES = ["Neue Komponente", "Neues Diagramm"] as const;

const placeholderKey = (name: string): string =>
  name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("de-DE").replace(/\(?\d+\)?$/, "");

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
