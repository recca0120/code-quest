# schemas-layer-structure Specification

## Purpose
TBD - created by archiving change schemas-restructure. Update Purpose after archive.
## Requirements
### Requirement: Layer Directory Structure

`packages/schemas/src/` SHALL organize schema files into three subdirectories reflecting their role in the cross-boundary contract: `server/`, `adapter/`, `shared/`.

#### Scenario: Server layer contains server-client contract schemas
WHEN a schema defines a C2S payload or S2C event between server and client
THEN it SHALL reside in `server/` subdirectory

#### Scenario: Adapter layer contains summoner-server contract schemas
WHEN a schema defines the Summoner ↔ Server transport framing, transport interfaces, or shared control flow types used by summoner and server
THEN it SHALL reside in `adapter/` subdirectory (combining former `remote/` and `transport/`)

#### Scenario: Shared layer contains ownerless infrastructure
WHEN a utility, interface, or constant has no single producer and serves as infrastructure across layers
THEN it SHALL reside in `shared/` or at root `src/` level

### Requirement: Multi-Party Schemas Remain in packages/schemas

Any schema imported by two or more distinct apps SHALL remain in `packages/schemas`. Relocating multi-party schemas to a single app breaks the compile-time synchronization guarantee.

#### Scenario: ContentBlock stays in schemas
WHEN ContentBlock is used by summoner (transform), server (relay), and web (render)
THEN it SHALL remain in `packages/schemas` under `server/blocks.ts`

#### Scenario: ControlResponse stays in schemas
WHEN ControlResponse is used by summoner, server, and web
THEN it SHALL remain in `packages/schemas` under `adapter/common.ts`

### Requirement: Single-Party Schemas Removed from packages/schemas

Schemas with only one app as external consumer SHALL be moved to that app.

#### Scenario: preferences moves to apps/web
WHEN preferences schema has only apps/web as external consumer
THEN it SHALL reside in `apps/web/src/stores/preferences-schema.ts`
AND SHALL NOT be exported from `packages/schemas/src/index.ts`

### Requirement: Zero-Consumer Exports Removed

Exports with no external consumers outside `packages/schemas` SHALL be removed from the public API.

#### Scenario: clientMessageSchema removed
WHEN `clientMessageSchema` has no external consumers
THEN it SHALL be removed from `packages/schemas/src/index.ts`
AND its definition SHALL be deleted or inlined where needed internally

#### Scenario: messageContentSchema removed
WHEN `messageContentSchema` has no external consumers
THEN it SHALL be removed from `packages/schemas/src/index.ts`

### Requirement: common.ts Split by Role

The original `schemas/common.ts` SHALL be split into `adapter/common.ts` (ControlResponse) and `server/common.ts` (channel payloads), with zero-consumer exports removed.

#### Scenario: split produces two files
- WHEN the split is applied
- THEN adapter/common.ts exports ControlResponse and server/common.ts exports channel payloads

### Requirement: Public API Stability for Cross-Boundary Exports

All exports used by two or more apps SHALL remain accessible from `@code-quest/schemas` after restructuring with identical names.

#### Scenario: All multi-party exports resolve correctly
WHEN any app imports a multi-party schema from `@code-quest/schemas`
THEN the import SHALL resolve correctly after restructuring

