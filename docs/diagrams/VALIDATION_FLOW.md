# Validation Flow

Source: [validation-flow.mmd](./validation-flow.mmd)

This sequence diagram shows how diagram validation works.

The validation order is:

1. User creates or edits a diagram.
2. The diagram has a `metamodelId`; missing legacy values are treated as active metamodel during normalization.
3. An optional `viewpointId` is considered.
4. Validation uses the active metamodel.
5. Connection instances are checked against `ConnectionRule`.
6. Component and connection instances are checked against `ViewpointRule`.
7. `ValidationRule` checks mandatory or quality relationships.
8. `ValidationResult` is produced.
9. UI shows grouped errors and warnings.
