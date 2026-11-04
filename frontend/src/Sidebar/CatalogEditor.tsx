import { useState } from "react";
import { ELEMENT_COLUMNS, RELATION_COLUMNS, availablePropertyKeys } from "../../../backend/src/catalog/catalogModel";
import type { Catalog, SidebarState } from "./sidebarTypes";

interface Props {
  catalog: Catalog;
  sidebarState: SidebarState;
  canWrite: boolean;
  onSave: (patch: Partial<Catalog>) => Promise<void>;
  onOpen: () => void;
}

function toggled(list: string[], key: string, on: boolean): string[] {
  return on ? [...list.filter((item) => item !== key), key] : list.filter((item) => item !== key);
}

function Checklist({ items, selected, disabled, onToggle }: {
  items: Array<{ key: string; label: string }>;
  selected: string[];
  disabled: boolean;
  onToggle: (key: string, on: boolean) => void;
}) {
  if (items.length === 0) return <p className="muted">Keine Auswahl möglich.</p>;
  return (
    <div className="catalog-checklist">
      {items.map((item) => (
        <label key={item.key} className="catalog-check">
          <input type="checkbox" checked={selected.includes(item.key)} disabled={disabled} onChange={(event) => onToggle(item.key, event.target.checked)} />
          {item.label}
        </label>
      ))}
    </div>
  );
}

/** Right-hand panel for a catalog: which types, properties and columns it contains. */
export default function CatalogEditor({ catalog, sidebarState, canWrite, onSave, onOpen }: Props) {
  const [draft, setDraft] = useState(catalog);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(catalog);
  const disabled = !canWrite || saving;

  const set = <K extends keyof Catalog>(key: K, value: Catalog[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const concreteTypes = sidebarState.componentTypes.filter((type) => !type.isAbstract);
  const propertyKeys = availablePropertyKeys(draft, sidebarState);

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      // Property selections that no longer belong to the chosen types are dropped.
      await onSave({ ...draft, propertyKeys: draft.propertyKeys.filter((key) => propertyKeys.includes(key)) });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} maxLength={120} disabled={disabled} onChange={(event) => set("name", event.target.value)} /></label>
      <label>Beschreibung<textarea rows={2} value={draft.description} disabled={disabled} onChange={(event) => set("description", event.target.value)} /></label>
      <label>Inhalt
        <select value={draft.kind} disabled={disabled} onChange={(event) => set("kind", event.target.value === "relations" ? "relations" : "elements")}>
          <option value="elements">Elemente (Komponenten)</option>
          <option value="relations">Verbindungen</option>
        </select>
      </label>

      {draft.kind === "elements" ? (
        <>
          <fieldset className="catalog-fieldset">
            <legend>Elementtypen {draft.componentTypeIds.length === 0 && <span className="muted">(keine Auswahl = alle)</span>}</legend>
            <Checklist
              items={concreteTypes.map((type) => ({ key: type.id, label: type.layer ? `${type.name} (${type.layer})` : type.name }))}
              selected={draft.componentTypeIds}
              disabled={disabled}
              onToggle={(key, on) => set("componentTypeIds", toggled(draft.componentTypeIds, key, on))}
            />
          </fieldset>
          <fieldset className="catalog-fieldset">
            <legend>Eigenschaften</legend>
            <Checklist
              items={propertyKeys.map((key) => ({ key, label: key }))}
              selected={draft.propertyKeys}
              disabled={disabled}
              onToggle={(key, on) => set("propertyKeys", toggled(draft.propertyKeys, key, on))}
            />
          </fieldset>
        </>
      ) : (
        <fieldset className="catalog-fieldset">
          <legend>Verbindungstypen {draft.connectionTypeIds.length === 0 && <span className="muted">(keine Auswahl = alle)</span>}</legend>
          <Checklist
            items={sidebarState.connectionTypes.map((type) => ({ key: type.id, label: type.name }))}
            selected={draft.connectionTypeIds}
            disabled={disabled}
            onToggle={(key, on) => set("connectionTypeIds", toggled(draft.connectionTypeIds, key, on))}
          />
        </fieldset>
      )}

      <fieldset className="catalog-fieldset">
        <legend>Spalten</legend>
        <Checklist
          items={(draft.kind === "elements" ? ELEMENT_COLUMNS : RELATION_COLUMNS).map((column) => ({ key: column.key, label: column.label }))}
          selected={draft.columns}
          disabled={disabled}
          onToggle={(key, on) => set("columns", toggled(draft.columns, key, on))}
        />
      </fieldset>

      {saveError && <p className="sb-error" role="alert">{saveError}</p>}
      {canWrite && <button className="sb-save-btn" disabled={!dirty || saving || !draft.name.trim()} onClick={() => void save()}>{saving ? "Speichere…" : "Speichern"}</button>}
      <button className="sb-open-btn" onClick={onOpen}>Katalog öffnen</button>
    </div>
  );
}
