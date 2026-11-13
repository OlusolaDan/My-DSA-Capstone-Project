# API examples

The API uses bearer tokens for every private operation. Start the server from
the project root with `npm start`. Set `AUTH_TOKEN_SECRET` to a private value
of at least 32 bytes first; do not commit it to the repository.

**macOS/Linux**

```sh
export AUTH_TOKEN_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")"
npm start
```

**Windows PowerShell**

```powershell
$env:AUTH_TOKEN_SECRET = node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
npm start
```

The examples use `http://localhost:3000`. Copy each returned `token` into
`TOKEN` below. Authenticated requests use
`Authorization: Bearer TOKEN`; the API does not trust caller-supplied user IDs.

## Sign up and log in

Signup creates an attendee unless a role is specified. The available roles are
`attendee`, `organizer` and `staff`.

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@example.test","password":"a-long-password","role":"organizer"}'
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/auth/signup" `
  -H "Content-Type: application/json" `
  -d '{"email":"organizer@example.test","password":"a-long-password","role":"organizer"}'
```

Login uses `POST /api/auth/login` with the same `email` and `password` fields.
Both endpoints return a safe user object and a signed token. The password is
never returned. `GET /api/auth/me` returns the current account:

```powershell
curl.exe -i "http://localhost:3000/api/auth/me" -H "Authorization: Bearer TOKEN"
```

## Create and publish an event

Use the organizer token returned at signup or login:

```powershell
curl.exe -i -X POST "http://localhost:3000/api/events" `
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" `
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Hall","date":"2026-12-05T17:00:00Z"}'
```

Copy the returned event `id`, then add a ticket tier:

```powershell
curl.exe -i -X POST "http://localhost:3000/api/events/EVENT_ID/tiers" `
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" `
  -d '{"name":"General","priceCents":5000,"capacity":100}'
```

An event needs a tier before it can be published:

```powershell
curl.exe -i -X POST "http://localhost:3000/api/events/EVENT_ID/publish" `
  -H "Authorization: Bearer TOKEN"
```

Only the organizer who created an event can add tiers or publish it.

## Browse and book tickets

Event search and details are public:

```powershell
curl.exe -i "http://localhost:3000/api/events?q=tech&city=lagos&sortBy=date"
curl.exe -i "http://localhost:3000/api/events/EVENT_ID"
```

Sign up or log in as an attendee, then use that attendee's token to book. Copy
the tier `id` from the event response:

```powershell
curl.exe -i -X POST "http://localhost:3000/api/bookings" `
  -H "Authorization: Bearer ATTENDEE_TOKEN" -H "Content-Type: application/json" `
  -d '{"tierId":"TIER_ID","quantity":2}'
```

Pay for the returned booking reference (payment is simulated):

```powershell
curl.exe -i -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay" `
  -H "Authorization: Bearer ATTENDEE_TOKEN" `
  -H "Content-Type: application/json" -d '{"decline":false}'
```

To simulate a declined payment, use `{"decline":true}`. The booking stays
pending and can be retried. Attendees can list, read or cancel only their own
bookings:

```powershell
curl.exe -i "http://localhost:3000/api/bookings" -H "Authorization: Bearer ATTENDEE_TOKEN"
curl.exe -i "http://localhost:3000/api/bookings/BOOKING_REFERENCE" -H "Authorization: Bearer ATTENDEE_TOKEN"
curl.exe -i -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel" `
  -H "Authorization: Bearer ATTENDEE_TOKEN"
```

Another attendee's booking is reported as `NOT_FOUND`.
