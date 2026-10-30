# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 1

### Prompt 1: Build 1 prompt (docs/build-1.md)
- **What I asked:** Create the JavaScript domain core, terminal demo, lookup benchmark, and npm scripts.
- **What came back:** Domain errors, cryptographic ids and booking references, linked queue, in-memory inventory, demo, and benchmark.
- **What was wrong (or "nothing"):** I reviewed the validation and inventory mutation order and adjusted the event date check to reject impossible calendar dates.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:** Build a stable, non-mutating merge sort; event publishing and summaries; pure event filtering, sorting, and search; acceptance-criteria tests; and an `npm test` script.
- **What came back:** Implementations in `sorting.js`, `inventory.js`, and `eventSearch.js`, plus tests and the npm script.
- **What was wrong (or "nothing"):** S04's three acceptance criteria were still a placeholder in the Build 2 brief, so I wrote criteria for publication without tiers, publishing with tiers, and hiding drafts. `npm test` then passed all 21 tests.

## Build 3

### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** Add the architecture diagrams, booking state machine, Node HTTP router/server, configuration, startup script, and tests.
- **What came back:** A layered architecture document, explicit booking transitions, static-file HTTP server, `/health` route, startup configuration, and `node:test` coverage.
- **What was wrong (or "nothing"):** The first server draft relied on an implicit response/request property for HEAD handling and had redundant error-status logic; both were simplified. Added a regression test proving static requests cannot escape `public/`.

## Build 4

### Prompt 1: Build 4 prompt (docs/build-4.md)
- **What I asked:** Build an in-memory REST API with async repositories, injected services, mock payments, event and booking routes, curl examples, and real-server API tests.
- **What came back:** Repository, event and booking services, mock payment gateway, API routes, a composed server, curl examples, and passing end-to-end HTTP tests.
- **What was wrong:** The HTTP error mapper returned 500 for expected `INVALID_STATE` and `SOLD_OUT` errors; invalid `onlyAvailable` values were silently treated as false; and API tests did not verify unpaid cancellation, released inventory, or the already-paid retry rule. I mapped domain conflicts to 409, validated the query parameter, and added real-server regression coverage. Earlier, the first cancellation implementation followed the shared state machine and allowed `paid` bookings to be cancelled; Build 4 permits cancellation only while pending, so the service now returns `INVALID_TRANSITION` with HTTP 409.
