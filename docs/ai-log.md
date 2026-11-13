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

## Build 5

### Prompt 1: move to SQLite and reproduce the problem
- **What I asked:** Add a `node:sqlite` database and schema, a SQLite repository compatible with the existing services, an idempotent seed script, and a 50-request oversell demo. Persist server data across restarts, but do not fix overselling yet.

- **What came back:** SQLite tables and parameterized repository methods, persistent server wiring, seed and oversell scripts, package commands, and repository tests. The demo began with one seat left and showed all 50 concurrent requests succeeding; the tier recorded 2 sold despite 51 total bookings including the initial booking.

- **What was wrong (or "nothing"):** The first constraint test assumed SQLite would report a `CHECK` failure using an `ERR_SQLITE_CONSTRAINT_CHECK` code, but this Node runtime reports a general SQLite error with the check detail in its message. I corrected the assertion; the oversell behavior remains intentionally unfixed.



### Prompt 2: fix it
- **What I asked:** Reserve inventory with one conditional atomic SQLite update, reject failed reservations as `SOLD_OUT`, add a 50-request regression test, and rerun the oversell demo.

- **What came back:** The booking service reserves seats through `reserveTierSeats`, using the conditional atomic SQLite update `UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND sold + ? <= capacity`. The demo now reports 1 concurrent success, 49 `SOLD_OUT` responses, and 2/2 seats sold including the initial booking; the new regression test verifies the one-seat case, and all 31 tests pass.

- **What was wrong (or "nothing"):** The first version of the updated demo used `Promise.all`, which would reject as soon as a request failed with `SOLD_OUT` instead of reporting the full batch. I changed it to `Promise.allSettled` and explicitly counted unexpected errors. A lock variable is process-local and cannot coordinate other database writers; checking twice still leaves a race between the availability check and the write, so the condition belongs in one atomic database update.

## Build 6

### Prompt 1: Build 6 prompt (docs/build-6.md)
- **What I asked:** Build the mock-data event browser and checkout in plain HTML, CSS, and browser JavaScript modules, including filters, sold-out tiers, a hold countdown, and retryable mock payments.
- **What came back:** Two pages, a safe DOM helper, mock API and data modules, responsive styles, and tests for browse, booking, and payment behavior.
- **What was wrong (or "nothing"):** The first API draft imported the existing search module from outside `public/`; the static server correctly does not serve that path. I moved the needed filtering and sorting into the browser API module and verified the complete flow in the browser, including a declined payment retry. The hold duration was not specified, so I used a 10-minute mock hold.

## Build 7

### Prompt 1: Build 7 prompt (docs/build-7.md)
- **What I asked:** Add signup and login with password hashing, HS256 bearer tokens, role-based authorization, per-user booking privacy, and the browser-connected auth flow.
- **What came back:** Password hashing in `src/lib/password.js`, token signing and verification in `src/lib/token.js`, auth service/routes, guarded API routes, and a connected browser auth flow.
- **What was wrong:** The working tree had a corrupted `test/build-7-auth.test.js` file containing NUL bytes, and the AI log itself had been partially overwritten in the same way. I restored the build-7 auth tests and the AI log from the repository version, then reran the full `npm test` suite; the implementation was already correct and the project passes cleanly under the Build 7 requirements.
