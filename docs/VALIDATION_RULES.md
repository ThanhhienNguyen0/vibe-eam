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
- `layer` must be one of:
  - `Business`
  - `Application`
  - `Data`
  - `Technology`
- `risk` must be one of `low`, `medium`, `high`.
- `status` must be one of `planned`, `active`, `deprecated`, `retired`.
- `cost` must be a non-negative number.
- `customAttributes` must be a key-value object.

## Relation Rules

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

## Import Rules

- Imported JSON must contain `elements` and `relations`.
- The imported model replaces the current model only if all element and relation rules pass.
- Existing audit log entries are retained and an import event is appended.

## MVP Boundary

The validation checks structural correctness. It does not enforce ArchiMate semantics, lifecycle consistency, date order, naming conventions, or enterprise governance rules.
