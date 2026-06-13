# Model vs Metamodel

Source: [model-vs-metamodel.mmd](./model-vs-metamodel.mmd)

This diagram explains the difference between the customer-specific metamodel and a concrete diagram model.

- Metamodel level: defines allowed component types, relation types, connection rules, viewpoint rules and validation rules.
- Model level: contains concrete component instances and connection instances inside a diagram.
- Validation level: checks whether the concrete model follows the metamodel and produces a `ValidationResult`.

Example:

- Metamodel rule: `Application --serves--> Business Process`
- Concrete model: `ERP System --serves--> Order to Cash`
