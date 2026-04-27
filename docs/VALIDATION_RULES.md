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
