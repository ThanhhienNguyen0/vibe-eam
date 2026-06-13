# ConnectionRule Example

Source: [connection-rule-example.mmd](./connection-rule-example.mmd)

The diagram separates examples that are explicitly allowed by `ConnectionRule` from examples rejected by validation.

Allowed examples:

- `Application --serves--> Business Process`
- `Application --uses--> Data Object`
- `Application --depends_on--> Technology Node`
- `Stakeholder --responsible_for--> Application`
- `Stakeholder --interested_in--> Business Capability`
- `Goal / Objective --supports--> Business Capability`

Rejected examples:

- `Data Object --serves--> Business Capability`
- `Stakeholder --depends_on--> Technology Node`
- `Technology Node --realizes--> Business Process`
