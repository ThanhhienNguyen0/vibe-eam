# Metamodel Diagrams

Mermaid files are the primary sources. Exported graphics are derived artifacts and are intentionally not committed in this cycle because the project does not currently include Mermaid CLI or another stable renderer.

The diagrams explain the rule model. The exchangeable customer configuration is the Metamodel JSON file documented in [../METAMODEL_JSON_FORMAT.md](../METAMODEL_JSON_FORMAT.md) and provided as `backend/src/data/default-metamodel.json`.

## Diagram Index

| Diagram | Purpose | Question Answered | Source |
| --- | --- | --- | --- |
| Metamodel Class Diagram | Shows the conceptual classes and relationships of the Rule Builder. | What are the main metamodel structures and how do they relate? | [metamodel-class-diagram.mmd](./metamodel-class-diagram.mmd) |
| Model vs Metamodel | Explains the difference between rules and concrete diagram instances. | What is a metamodel, and what is a model? | [model-vs-metamodel.mmd](./model-vs-metamodel.mmd) |
| ConnectionRule Example | Shows allowed and rejected relation examples. | Which relationships are allowed by ConnectionRule? | [connection-rule-example.mmd](./connection-rule-example.mmd) |
| ViewpointRule Diagram | Explains role-specific viewpoint constraints. | How are stakeholder views different from Stakeholder nodes? | [viewpoint-rule-diagram.mmd](./viewpoint-rule-diagram.mmd) |
| Validation Flow | Shows the validation sequence from diagram edit to ValidationResult. | What happens when a diagram is validated? | [validation-flow.mmd](./validation-flow.mmd) |

## Rendering

GitHub renders Mermaid diagrams embedded in Markdown. For local rendering, use one of:

- VS Code Mermaid Preview extension
- Mermaid Live Editor
- Optional Mermaid CLI (`mmdc`) if installed outside this project

Suggested export folder for generated files:

```text
docs/diagrams/exported/
```

No PNG/SVG exports are committed because adding Mermaid CLI would introduce a new rendering dependency for documentation only.
