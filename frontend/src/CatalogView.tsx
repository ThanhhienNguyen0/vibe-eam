import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, Search, Upload } from "lucide-react";
import {
  elementCatalogRows,
  elementCatalogs,
  propertyKeysForTypes,
  relationCatalogRows,
  type ElementCatalogRow,
  type RelationCatalogRow
} from "../../backend/src/catalog/catalogModel";
import { useAccess } from "./access";
import ImportDialog from "./ImportDialog";
import { sidebarApi } from "./Sidebar/sidebarApi";
import type { SidebarSelection } from "./Sidebar/Sidebar";
import type { SidebarState } from "./Sidebar/sidebarTypes";
import { transferApi, type TransferFormat } from "./transferApi";

interface Props {
  sidebarState: SidebarState;
  onStateChange: (state: SidebarState) => void;
  selection: SidebarSelection | null;
  onSelect: (selection: SidebarSelection) => void;
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

const RELATIONS = "relations";
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
  const shown = names.slice(0, 2).join(", ");
  return <span title={names.join(", ")}>{shown}{names.length > 2 ? ` +${names.length - 2}` : ""}</span>;
}

export default function CatalogView({ sidebarState, onStateChange, selection, onSelect }: Props) {
  const { canWrite } = useAccess();
  const [catalogId, setCatalogId] = useState("all");
  const [query, setQuery] = useState("");
  const [connectionTypeId, setConnectionTypeId] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "name", direction: "asc" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const catalogs = useMemo(() => elementCatalogs(sidebarState), [sidebarState]);
  const showingRelations = catalogId === RELATIONS;
  const activeCatalog = catalogs.find((item) => item.id === catalogId) ?? catalogs[0];
  const types = activeCatalog.typeIds.length > 0
    ? sidebarState.componentTypes.filter((type) => activeCatalog.typeIds.includes(type.id))
    : sidebarState.componentTypes.filter((type) => !type.isAbstract);
  const propertyKeys = activeCatalog.typeIds.length > 0 ? propertyKeysForTypes(types) : [];

  const elementRows = useMemo(
    () => (showingRelations ? [] : elementCatalogRows(sidebarState, { typeIds: activeCatalog.typeIds, query })),
    [sidebarState, showingRelations, activeCatalog, query]
  );
  const relationRows = useMemo(
    () => (showingRelations ? relationCatalogRows(sidebarState, { connectionTypeIds: connectionTypeId ? [connectionTypeId] : [], query }) : []),
    [sidebarState, showingRelations, connectionTypeId, query]
  );

  const elementColumns: Column<ElementCatalogRow>[] = [
    { key: "name", title: "Name", value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    ...(activeCatalog.typeIds.length === 0 ? [
      { key: "type", title: "Typ", value: (row: ElementCatalogRow) => row.typeName },
      { key: "layer", title: "Ebene", value: (row: ElementCatalogRow) => row.layer }
    ] : []),
    { key: "externalId", title: "Externe ID", value: (row) => row.externalId },
    { key: "description", title: "Beschreibung", value: (row) => row.description, render: (row) => <span className="catalog-description">{row.description}</span> },
    ...propertyKeys.map((key): Column<ElementCatalogRow> => ({ key: `prop:${key}`, title: key, value: (row) => row.properties[key] ?? "" })),
    { key: "outgoing", title: "Ausgehend", value: (row) => row.outgoing, numeric: true },
    { key: "incoming", title: "Eingehend", value: (row) => row.incoming, numeric: true },
    { key: "diagrams", title: "Diagramme", value: (row) => row.diagrams.length, render: (row) => <DiagramList names={row.diagrams} /> }
  ];
  const relationColumns: Column<RelationCatalogRow>[] = [
    { key: "source", title: "Quelle", value: (row) => row.sourceName, render: (row) => <strong>{row.sourceName}</strong> },
    { key: "type", title: "Typ", value: (row) => row.typeName },
    { key: "target", title: "Ziel", value: (row) => row.targetName, render: (row) => <strong>{row.targetName}</strong> },
    { key: "name", title: "Name", value: (row) => row.name },
    { key: "externalId", title: "Externe ID", value: (row) => row.externalId },
    { key: "description", title: "Beschreibung", value: (row) => row.description, render: (row) => <span className="catalog-description">{row.description}</span> }
  ];

  const total = showingRelations ? sidebarState.connections.length : activeCatalog.count;
  const shown = showingRelations ? relationRows.length : elementRows.length;
  const effectiveSort = (columns: Column<unknown>[]): Sort =>
    columns.some((column) => column.key === sort.key) ? sort : { key: columns[0].key, direction: "asc" };

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

  const exportAs = (format: TransferFormat) => run(() => transferApi.exportModel({
    format,
    // XLSX of an element catalog contains both sheets (relations between the exported elements); CSV is one table.
    sheet: showingRelations ? "relations" : format === "csv" ? "elements" : undefined,
    typeIds: showingRelations ? [] : activeCatalog.typeIds,
    connectionTypeIds: showingRelations && connectionTypeId ? [connectionTypeId] : [],
    query
  }));

  const selectedId = selection && "id" in selection ? selection.id : null;
  const filtered = query.trim() !== "" || (showingRelations && connectionTypeId !== "") || activeCatalog.typeIds.length > 0;

  function renderTable<Row extends { id: string }>(rows: Row[], columns: Column<Row>[], kind: "component" | "connection") {
    const ordered = sortRows(rows, columns, effectiveSort(columns as Column<unknown>[]));
    const activeSort = effectiveSort(columns as Column<unknown>[]);
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
        {ordered.length === 0 && <p className="catalog-empty">Keine Einträge{filtered ? " für diese Auswahl" : ""}.</p>}
      </div>
    );
  }

  return (
    <div className="catalog-view">
      <header className="catalog-header">
        <div>
          <h2>Kataloge</h2>
          <p className="muted">Überblick über alle Elemente und Verbindungen. Die Auswahl hier ist auch die Grundlage für den Export.</p>
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
        </div>
      </header>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="catalog-body">
        <nav className="catalog-nav" aria-label="Kataloge">
          {catalogs.map((catalog) => (
            <button
              key={catalog.id}
              type="button"
              className={`catalog-nav-item${catalog.id === activeCatalog.id && !showingRelations ? " active" : ""}`}
              onClick={() => setCatalogId(catalog.id)}
            >
              <span>{catalog.label}{catalog.layer && <small>{catalog.layer}</small>}</span>
              <em>{catalog.count}</em>
            </button>
          ))}
          <button
            type="button"
            className={`catalog-nav-item catalog-nav-separated${showingRelations ? " active" : ""}`}
            onClick={() => setCatalogId(RELATIONS)}
          >
            <span>Verbindungen</span>
            <em>{sidebarState.connections.length}</em>
          </button>
        </nav>

        <section className="catalog-main" aria-live="polite">
          <div className="catalog-toolbar">
            <label className="catalog-search">
              <Search size={14} />
              <input type="search" placeholder="Suchen in Name, Beschreibung, Externe ID, Eigenschaften…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            {showingRelations && (
              <select value={connectionTypeId} onChange={(event) => setConnectionTypeId(event.target.value)} aria-label="Verbindungstyp">
                <option value="">Alle Verbindungstypen</option>
                {sidebarState.connectionTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            )}
            <span className="catalog-count">{shown} von {total}</span>
            <button type="button" onClick={() => exportAs("xlsx")} disabled={busy} title={showingRelations ? "Aktuelle Auswahl als Excel exportieren" : "Aktuelle Auswahl als Excel (Elemente und Relationen) exportieren"}>
              <Download size={14} /> Excel
            </button>
            <button type="button" onClick={() => exportAs("csv")} disabled={busy} title="Aktuelle Auswahl als CSV exportieren">
              <Download size={14} /> CSV
            </button>
          </div>

          {showingRelations
            ? renderTable(relationRows, relationColumns, "connection")
            : renderTable(elementRows, elementColumns, "component")}
        </section>
      </div>

      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={async () => onStateChange(await sidebarApi.getAll())}
        />
      )}
    </div>
  );
}
