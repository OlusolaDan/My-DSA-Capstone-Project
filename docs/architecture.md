# Build 3 architecture

## Layers

```mermaid
flowchart TD
  Client --> Routes
  Routes --> Services
  Services --> Rules
  Services --> Repositories
  Repositories --> Database[(Database)]
```

- **Routes** may read HTTP input, call services, and format responses; they may not contain business rules or access storage directly.
- **Services** may coordinate domain rules and repositories; they may not depend on HTTP details or call routes.
- **Rules** may enforce business invariants and use domain data; they may not perform HTTP or file/database I/O.
- **Repositories** may load and save data; they may not decide business policy or call services/routes.

## Data model

```mermaid
erDiagram
  EVENTS ||--|{ TICKET_TIERS : offers
  EVENTS ||--o{ BOOKINGS : has
  TICKET_TIERS ||--o{ BOOKINGS : purchased_from
  USERS ||--o{ BOOKINGS : places
  EVENTS {
    string id PK
    string title
    string city
    string venue
    datetime date
    string status
  }
  TICKET_TIERS {
    string id PK
    string event_id FK
    string name
    int price_cents
    int capacity
  }
  BOOKINGS {
    string id PK
    string tier_id FK
    string user_id FK
    int quantity
    int total_cents
    string status
  }
  USERS {
    string id PK
    string name
    string email
    string role
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```
