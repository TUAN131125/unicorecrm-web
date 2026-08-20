# API evolution and deprecation policy

- Production base path carries the major version: `/v1`.
- Additive schema/operation changes require OpenAPI lint, generated-client drift, fixtures, and provider-contract review.
- Breaking changes require either a new major base path or an explicit pre-implementation baseline approval with a recorded compatibility strategy.
- A deprecated operation must be marked in OpenAPI and return `Deprecation`, `Sunset`, and `Link` headers; the minimum notice expectation is 90 days.
- Unknown closed-enum values fail closed. Extension points must be explicitly modeled rather than inferred from undocumented strings.
- Removing a deprecated operation requires breaking-change review and a successor link.
