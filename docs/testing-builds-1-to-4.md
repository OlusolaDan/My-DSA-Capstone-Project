# Running Checks for Builds 1–4

This guide covers the checks for Builds 1 through 4 in this repository. Run
commands from the project root (the folder containing `package.json`). No
`npm install` is needed; the project uses Node.js built-in tools.

## Prerequisites

Check that Node.js is installed and meets the project minimum:

```powershell
node --version
```

Use Node.js 22.13 or newer. The test suite uses Node's built-in test runner.

## Build 1: Domain core

Build 1 does not have a dedicated automated test file. Its defined checks are
the demo and benchmark:

```powershell
npm run demo
npm run benchmark
```

The demo should show an event selling out, an attempted booking being refused,
people joining the waitlist, a cancellation freeing seats, and the next person
in the waitlist. Generated IDs and booking references will differ between runs.

The benchmark compares looking up bookings with `Map.get` and `Array.find`.
Exact timings depend on your computer; the `Map` lookup should be much faster.

## Build 2: Search, sorting, and domain tests

Run the Build 2 test file on its own:

```powershell
node --test test/build-2.test.js
```

It exercises the domain behavior introduced in Build 2, including event
creation, ticket tiers, booking rules, search, filtering, sorting, and validation.
For the full project test suite, use:

```powershell
npm test
```

## Build 3: State machine, router, and server

Run the Build 3 test file:

```powershell
node --test test/build-3.test.js
```

It checks booking-state transitions, routing, and the server's health endpoint.
To start the server manually and check `/health`, use two PowerShell windows.

In the first window:

```powershell
npm start
```

In the second window:

```powershell
curl.exe -i http://localhost:3000/health
```

The health check should return HTTP 200 and JSON with `"status":"ok"`. Stop the
manually started server with `Ctrl+C` when finished.

## Build 4: REST API

Run the API test file:

```powershell
node --test test/build-4-api.test.js
```

These tests start the real server on a free port and check API behavior, including
event creation, ticket tiers, publishing, event search, booking, payment, and
error responses. You do not need to start the server separately for this test.

To run all checked-in automated tests for Builds 2–4 together:

```powershell
npm test
```

## If a check fails

Read the test output for the failing test name and error. Confirm you are in the
project root and that `node --version` reports 22.13 or newer. A nonzero command
exit code means the check failed.