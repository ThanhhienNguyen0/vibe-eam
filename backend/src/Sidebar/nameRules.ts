/**
 * #108/#113: Shared name rule for components and diagrams.
 * The frontend mirrors this rule in frontend/src/Sidebar/nameRules.ts so the form can react early;
 * the server stays authoritative because data can also arrive through other clients.
 */

export type NameRuleCode = "NAME_REQUIRED" | "NAME_PLACEHOLDER";

export interface NameRuleViolation {
  code: NameRuleCode;
  field: "name";
  error: string;
}

export interface NameRuleOptions {
  /** Stored name on an update: an unchanged legacy placeholder needs no new confirmation. */
  previousName?: string;
  /** The user saw the placeholder warning and confirmed it a second time. Never stored. */
  acknowledgePlaceholder?: boolean;
}

/** Names the app itself used to generate before #113. They describe nothing and make lists indistinguishable. */
export const PLACEHOLDER_NAMES = ["Neue Komponente", "Neues Diagramm"] as const;

const placeholderKey = (name: string): string =>
  name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("de-DE").replace(/\(?\d+\)?$/, "");

const PLACEHOLDER_KEYS = new Set<string>(PLACEHOLDER_NAMES.map(placeholderKey));

/** "Neue Komponente", "neue  komponente 2" or "Neues Diagramm (3)" count as placeholders. */
export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_KEYS.has(placeholderKey(name));
}

/**
 * Checks a name that is about to be stored. An empty name is always rejected. A placeholder is allowed,
 * but only with `acknowledgePlaceholder`, so no client can store one without an explicit confirmation.
 */
export function checkElementName(value: unknown, options: NameRuleOptions = {}): { name: string } | NameRuleViolation {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    return { code: "NAME_REQUIRED", field: "name", error: "Bitte einen Namen eingeben. Ein leerer Name oder nur Leerzeichen sind nicht erlaubt." };
  }
  const unchanged = options.previousName !== undefined && options.previousName.trim() === name;
  if (isPlaceholderName(name) && !unchanged && options.acknowledgePlaceholder !== true) {
    return {
      code: "NAME_PLACEHOLDER",
      field: "name",
      error: `„${name}“ ist ein Platzhaltername. Bitte einen aussagekräftigen Namen eingeben oder den Platzhalter ausdrücklich bestätigen.`
    };
  }
  return { name };
}
