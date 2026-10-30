# Build 4 API examples

Start the server from the project root with `npm start`. The examples use
`http://localhost:3000` and the sample caller IDs shown below.

Each request is shown twice:

- **macOS/Linux:** multiline commands using the POSIX shell `\` line
  continuation.
- **Windows PowerShell:** `curl.exe` commands. PowerShell uses the backtick
  (`) for line continuation, and `curl.exe` avoids PowerShell's `curl` alias.

Use the returned event `id`, tier `id`, and booking `reference` in place of the
uppercase placeholders. The API stores data in memory, so create and use the
event while the same server process is running.

## Create an event

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/events" \
  -H "Content-Type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Hall","date":"2026-12-05T17:00:00Z"}'
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/events" `
  -H "Content-Type: application/json" `
  -H "x-user-id: organizer-1" `
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Hall","date":"2026-12-05T17:00:00Z"}'
```

The successful response has status `201` and returns the event, including its
generated `id`. Copy that ID for the following requests.

## Add a ticket tier

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/events/EVENT_ID/tiers" \
  -H "Content-Type: application/json" \
  -H "x-user-id: organizer-1" \
  -d '{"name":"General","priceCents":5000,"capacity":100}'
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/events/EVENT_ID/tiers" `
  -H "Content-Type: application/json" `
  -H "x-user-id: organizer-1" `
  -d '{"name":"General","priceCents":5000,"capacity":100}'
```

Replace `EVENT_ID` with the event ID. Copy the returned tier `id` for booking.

## Publish the event

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/events/EVENT_ID/publish" \
  -H "x-user-id: organizer-1"
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/events/EVENT_ID/publish" `
  -H "x-user-id: organizer-1"
```

Replace `EVENT_ID` with the event ID. An event must have at least one tier
before it can be published.

## Search published events

**macOS/Linux**

```sh
curl -i "http://localhost:3000/api/events?q=tech&city=lagos&sortBy=date"
```

**Windows PowerShell**

```powershell
curl.exe -i "http://localhost:3000/api/events?q=tech&city=lagos&sortBy=date"
```

Copy a tier `id` from the search result for the booking request.

## Book tickets

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/bookings" \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"tierId":"TIER_ID","quantity":2}'
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/bookings" `
  -H "Content-Type: application/json" `
  -H "x-user-id: attendee-1" `
  -d '{"tierId":"TIER_ID","quantity":2}'
```

Replace `TIER_ID` with the tier ID. Copy the returned booking `reference` for
the payment or cancellation request.

## Pay for a booking

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay" \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"decline":false}'
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay" `
  -H "Content-Type: application/json" `
  -H "x-user-id: attendee-1" `
  -d '{"decline":false}'
```

Replace `BOOKING_REFERENCE` with the booking reference. To simulate a declined
payment, use `{"decline":true}` instead; the booking stays pending and can be
retried.

## Cancel an unpaid booking

This is an alternative to paying: cancel a pending booking before paying it.
A booking that has been paid cannot be cancelled by this API in Build 4.

**macOS/Linux**

```sh
curl -i -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel" \
  -H "x-user-id: attendee-1"
```

**Windows PowerShell**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel" `
  -H "x-user-id: attendee-1"
```

Replace `BOOKING_REFERENCE` with the reference of a pending booking made by
`attendee-1`.
