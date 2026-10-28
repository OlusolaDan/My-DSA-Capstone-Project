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
- **What I asked:** Create a stable non-mutating merge sort, pure event filtering, sorting, and search in, then tests covering the build 2 acceptance criteria and npm test script. 
- **What came back:** sorting.js, inventory.js, and eventSearch.js and npm test script
- **What was wrong (or "nothing"):** I ran "npm test", node --iput and I got = [ 'b', 'a', 'c' ] [ 'a', 'b', 'c' ] true

## Build 3

### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** Add the architecture diagrams, booking state machine, Node HTTP router/server, configuration, startup script, and tests.
- **What came back:** A layered architecture document, explicit booking transitions, static-file HTTP server, `/health` route, startup configuration, and `node:test` coverage.
- **What was wrong (or "nothing"):** The first server draft relied on an implicit response/request property for HEAD handling and had redundant error-status logic; both were simplified. Added a regression test proving static requests cannot escape `public/`.
