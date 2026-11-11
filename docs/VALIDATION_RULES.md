# Validation Rules

## Element Rules

- `id` is required.
- `id` must be unique when creating or importing a model.
- `name` is required.
- `type` must be one of:
  - `Business Capability`
  - `Business Process`
  - `Application Component`
  - `Data Object`
  - `Technology Node`
- `type` determines `layer`:
  - `Business Capability` -> `Business`
  - `Business Process` -> `Business`
  - `Application Component` -> `Application`
  - `Data Object` -> `Data`
  - `Technology Node` -> `Technology`
- `risk` must be one of `low`, `medium`, `high`.
- `status` must be one of `planned`, `active`, `deprecated`, `retired`.
- `cost` must be a non-negative number.
- `customAttributes` must be a key-value object.

## Structural Relation Rules

- `id` is required.
- `id` must be unique when creating or importing a model.
- `source` must reference an existing element.
- `target` must reference an existing element.
- `source` and `target` must not be identical.
- `type` must be one of:
  - `uses`
  - `depends_on`
  - `realizes`
  - `serves`

## Semantic Relation Rules

Relations must match the EAM metamodel:

| Source Type | Relation | Target Type |
| --- | --- | --- |
| Business Process | realizes | Business Capability |
| Application Component | serves | Business Process |
| Application Component | uses | Data Object |
| Application Component | depends_on | Technology Node |
| Application Component | depends_on | Application Component |
| Data Object | depends_on | Technology Node |
| Technology Node | depends_on | Technology Node |

Example validation error:

```text
Relation 'serves' from Data Object to Business Capability is not allowed by the EAM metamodel.
```

## Import Rules

- Imported JSON must contain `elements` and `relations`.
- The imported model replaces the current model only if all element and relation rules pass.
- All imported relations are semantically validated against the EAM metamodel.
- Existing audit log entries are retained and an import event is appended.

## MVP Boundary

The validation now checks basic EAM semantics. It still does not enforce lifecycle date order, naming conventions, ownership, governance workflow, capability hierarchy, data classification rules, or a full ArchiMate-compatible metamodel.

## Component Duplicate Rule (REQ-02)

Applies to `ComponentInstance` in the sidebar/diagram repository (`/api/sidebar/components`).

- Two components are possible duplicates when they have the **same `componentTypeId`** and the **same normalized name**.
- Normalization: Unicode NFKC, all whitespace removed, lower-cased (`de-DE`). `"SAP ERP"`, `" sap  erp "` and `"SAPERP"` match; the same name in a different component type does not.
- The rule is a **warning, never a hard error**. `POST /components` and `PATCH /components/:id` (only when `name` or `componentTypeId` changes) always succeed and return a `warnings` array in the response body:

  ```json
  { "id": "…", "name": "customer portal", "…": "…",
    "warnings": [{ "code": "DUPLICATE_COMPONENT", "message": "…", "duplicates": [{ "id": "…", "name": "Customer Portal" }] }] }
  ```

- Optional request field `acknowledgeDuplicate: true` signals that the user saw the warning and deliberately created or saved the element anyway. It is never stored on the component.
- Every create or save that matches a duplicate writes a REQ-23 business event `duplicate.accepted` in the same transaction as the change (`GET /api/sidebar/audit-log`). `details` contains `acknowledged` and the ids/names of the existing duplicates. This also covers creation inside a diagram (`POST /diagrams/:id/components`).
- UI: the canvas create dialog and the component properties panel show the hint with a link to the existing element and the option "Vorhandenes Element verwenden". In the panel this option only appears while the new element is still unused (in no diagram, no connections), because it discards the new element.
- **Metamodel types** follow the same rule: component types (`/component-types`) and connection types (`/connection-types`) warn when another type of the same kind has the same normalized name (codes `DUPLICATE_COMPONENT_TYPE`, `DUPLICATE_CONNECTION_TYPE`). Create and rename succeed, return `warnings` and are audited. The type editor shows the hint with a link to the existing type; quick creation uses unique default names ("Neuer Typ 2").
- Informational only (no warning in the API, no audit entry): a fresh, unused component whose name matches a component of another type shows "Gleicher Name bei anderem Typ" with the option to use the existing element, because sidebar quick creation assigns the first type before the user picks one.
- Limit: no fuzzy matching (typos, abbreviations).
