# Build 4 API examples

Start the server with `npm start`. These examples use `http://localhost:3000` and a sample caller id.

## Create an event

```sh
curl -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' -H 'x-user-id: organizer-1' \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Hall","date":"2026-12-05T17:00:00Z"}'
```

Copy the returned event `id` for the next two requests.

## Add a ticket tier

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H 'content-type: application/json' -H 'x-user-id: organizer-1' \
  -d '{"name":"General","priceCents":5000,"capacity":100}'
```

## Publish the event

```sh
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H 'x-user-id: organizer-1'
```

## Search published events

```sh
curl 'http://localhost:3000/api/events?q=tech&city=lagos&sortBy=date'
```

## Book tickets

Copy the returned tier `id` from the event search result.

```sh
curl -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' -H 'x-user-id: attendee-1' \
  -d '{"tierId":"TIER_ID","quantity":2}'
```

Copy the returned booking `reference` for paying or cancelling.

## Pay for a booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay \
  -H 'content-type: application/json' -H 'x-user-id: attendee-1' \
  -d '{"decline":false}'
```

To simulate a decline, send `{"decline":true}`; the booking remains pending and can be retried.

## Cancel an unpaid booking

```sh
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel \
  -H 'x-user-id: attendee-1'
```
