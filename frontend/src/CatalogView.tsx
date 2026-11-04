import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, Search, Upload, X } from "lucide-react";
import {
  catalogComponentTypes,
  catalogElementFilter,
  catalogPropertyKeys,
  catalogRelationFilter,
  elementCatalogRows,
  relationCatalogRows,
  type ElementCatalogRow,
  type RelationCatalogRow
} from "../../backend/src/catalog/catalogModel";
import { useAccess } from "./access";
import ImportDialog from "./ImportDialog";
import { sidebarApi } from "./Sidebar/sidebarApi";
import type { SidebarSelection } from "./Sidebar/Sidebar";
import type { Catalog, SidebarState } from "./Sidebar/sidebarTypes";
import { transferApi, type TransferFormat } from "./transferApi";

interface Props {
  catalog: Catalog;
  sidebarState: SidebarState;
  onStateChange: (state: SidebarState) => void;
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection) => void;
  onClose: () => void;
}

type SortDirection = "asc" | "desc";
interface Sort { key: string; direction: SortDirection }
interface Column<Row> {
  key: string;
  title: string;
  value: (row: Row) => string | number;
  render?: (row: Row) => React.ReactNode;
  numeric?: boolean;
}

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

function sortRows<Row>(rows: Row[], columns: Column<Row>[], sort: Sort): Row[] {
  const column = columns.find((item) => item.key === sort.key) ?? columns[0];
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = column.value(a);
    const right = column.value(b);
    const order = typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right));
    return order * factor;
  });
}

function DiagramList({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="muted">–</span>;
  return <span title={names.join(", ")}>{names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""}</span>;
}

/** Table view of one saved catalog: its types, property columns and standard columns. */
export default function CatalogView({ catalog, sidebarState, onStateChange, selection, onSelect, onClose }: Props) {
  const { canWrite } = useAccess();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "name", direction: "asc" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const showingRelations = catalog.kind === "relations";
  const propertyKeys = useMemo(() => catalogPropertyKeys(catalog, sidebarState), [catalog, sidebarState]);
  const typeLabel = useMemo(
    () => (catalog.componentTypeIds.length === 0 ? "alle Typen" : catalogComponentTypes(catalog, sidebarState).map((type) => type.name).join(", ")),
    [catalog, sidebarState]
  );

  const elementRows = useMemo(
    () => (showingRelations ? [] : elementCatalogRows(sidebarState, catalogElementFilter(catalog, sidebarState, query))),
    [sidebarState, catalog, showingRelations, query]
  );
  const relationRows = useMemo(
    () => (showingRelations ? relationCatalogRows(sidebarState, catalogRelationFilter(catalog, sidebarState, query)) : []),
    [sidebarState, catalog, showingRelations, query]
  );

  const has = (key: string) => catalog.columns.includes(key);
  const elementColumns: Column<ElementCatalogRow>[] = [
    { key: "name", title: "Name", value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    ...(has("type") ? [{ key: "type", title: "Typ", value: (row: ElementCatalogRow) => row.typeName }] : []),
    ...(has("layer") ? [{ key: "layer", title: "Ebene", value: (row: ElementCatalogRow) => row.layer }] : []),
    ...(has("externalId") ? [{ key: "externalId", title: "Externe ID", value: (row: ElementCatalogRow) => row.externalId }] : []),
    ...(has("description") ? [{ key: "description", title: "Beschreibung", value: (row: ElementCatalogRow) => row.description, render: (row: ElementCatalogRow) => <span className="catalog-description">{row.description}</span> }] : []),
    ...propertyKeys.map((key): Column<ElementCatalogRow> => ({ key: `prop:${key}`, title: key, value: (row) => row.properties[key] ?? "" })),
    ...(has("outgoing") ? [{ key: "outgoing", title: "Ausgehend", value: (row: ElementCatalogRow) => row.outgoing, numeric: true }] : []),
    ...(has("incoming") ? [{ key: "incoming", title: "Eingehend", value: (row: ElementCatalogRow) => row.incoming, numeric: true }] : []),
    ...(has("diagrams") ? [{ key: "diagrams", title: "Diagramme", value: (row: ElementCatalogRow) => row.diagrams.length, render: (row: ElementCatalogRow) => <DiagramList names={row.diagrams} /> }] : [])
  ];
  const relationColumns: Column<RelationCatalogRow>[] = [
    { key: "source", title: "Quelle", value: (row) => row.sourceName, render: (row) => <strong>{row.sourceName}</strong> },
    ...(has("type") ? [{ key: "type", title: "Typ", value: (row: RelationCatalogRow) => row.typeName }] : []),
    { key: "target", title: "Ziel", value: (row) => row.targetName, render: (row) => <strong>{row.targetName}</strong> },
    ...(has("name") ? [{ key: "name", title: "Name", value: (row: RelationCatalogRow) => row.name }] : []),
    ...(has("externalId") ? [{ key: "externalId", title: "Externe ID", value: (row: RelationCatalogRow) => row.externalId }] : []),
    ...(has("description") ? [{ key: "description", title: "Beschreibung", value: (row: RelationCatalogRow) => row.description, render: (row: RelationCatalogRow) => <span className="catalog-description">{row.description}</span> }] : [])
  ];

  const shown = showingRelations ? relationRows.length : elementRows.length;

  function toggleSort(key: string) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Aktion ist fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const exportAs = (format: TransferFormat) => run(() => transferApi.exportModel({ format, catalogId: catalog.id, query }));
  const selectedId = selection && "id" in selection ? selection.id : null;

  function renderTable<Row extends { id: string }>(rows: Row[], columns: Column<Row>[], kind: "component" | "connection") {
    const activeSort = columns.some((column) => column.key === sort.key) ? sort : { key: columns[0].key, direction: "asc" as SortDirection };
    const ordered = sortRows(rows, columns, activeSort);
    return (
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.numeric ? "catalog-num" : undefined} aria-sort={activeSort.key === column.key ? (activeSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="catalog-sort" onClick={() => toggleSort(column.key)}>
                    {column.title}
                    {activeSort.key === column.key && (activeSort.direction === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr
                key={row.id}
                className={row.id === selectedId ? "selected" : undefined}
                tabIndex={0}
                onClick={() => onSelect({ kind, id: row.id })}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect({ kind, id: row.id }); } }}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? "catalog-num" : undefined}>
                    {column.render ? column.render(row) : (column.value(row) === "" ? <span className="muted">–</span> : String(column.value(row)))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {ordered.length === 0 && <p className="catalog-empty">Keine Einträge{query.trim() ? " für diese Suche" : ""}.</p>}
      </div>
    );
  }

  return (
    <div className="catalog-view">
      <header className="catalog-header">
        <div>
          <h2>{catalog.name}</h2>
          <p className="muted">
            {catalog.description || (showingRelations ? "Verbindungen" : "Elemente")}
            {" · "}
            {showingRelations
              ? (catalog.connectionTypeIds.length === 0 ? "alle Verbindungstypen" : `${catalog.connectionTypeIds.length} Verbindungstyp(en)`)
              : typeLabel}
            {" · Spalten und Auswahl im rechten Panel unter dem Katalog anpassen."}
          </p>
        </div>
        <div className="catalog-actions">
          <button type="button" onClick={() => run(() => transferApi.downloadTemplate("xlsx"))} disabled={busy} title="Excel-Vorlage mit Hinweisen herunterladen">
            <FileSpreadsheet size={14} /> Import-Vorlage
          </button>
          {canWrite && (
            <button type="button" className="catalog-primary" onClick={() => setImportOpen(true)} disabled={busy}>
              <Upload size={14} /> Importieren…
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Katalog schließen" title="Katalog schließen"><X size={14} /></button>
        </div>
      </header>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="catalog-main catalog-main--single" aria-live="polite">
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <Search size={14} />
            <input type="search" placeholder="Suchen in Name, Beschreibung, Externe ID, Eigenschaften…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <span className="catalog-count">{shown} Einträge</span>
          <button type="button" onClick={() => exportAs("xlsx")} disabled={busy} title="Katalog als Excel exportieren">
            <Download size={14} /> Excel
          </button>
          <button type="button" onClick={() => exportAs("csv")} disabled={busy} title="Katalog als CSV exportieren">
            <Download size={14} /> CSV
          </button>
        </div>

        {showingRelations
          ? renderTable(relationRows, relationColumns, "connection")
          : renderTable(elementRows, elementColumns, "component")}
      </section>

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={async () => onStateChange(await sidebarApi.getAll())}
        />
      )}
    </div>
  );
}
