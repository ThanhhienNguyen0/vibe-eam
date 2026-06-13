# Metamodel Class Diagram

Source: [metamodel-class-diagram.mmd](./metamodel-class-diagram.mmd)

This class diagram describes the conceptual metamodel used by the Rule Builder.

Important reading notes:

- `ValidationEngine` is a logical concept. The code currently implements validation as pure functions in `metamodelRules.ts`, not as a concrete class.
- `ValidationResult` is produced by validation. It is not a persistent child object of `Diagram`.
- `Diagram.metamodelId` expresses conformance to the active `Metamodel`.
- `ConnectionRule` is the primary source for allowed source/relation/target combinations.
- `ViewpointRule` restricts component types, connection types and connection rules for a stakeholder-specific view.
- `ValidationRule` describes quality or mandatory relationship checks.
