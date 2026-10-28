import { addTier, bookTickets, cancelBooking, createEvent, createStore, findBookingByReference, joinWaitlist } from '../src/domain/inventory.js';

const store = createStore();
const event = createEvent(store, { title: 'Lagos Arts Night', city: 'Lagos', venue: 'Freedom Park', date: '2026-12-05' });
const tier = addTier(store, event.id, { name: 'General', priceCents: 5000, capacity: 3 });

const adaBooking = bookTickets(store, tier.id, 'Ada', 2);
console.log(`Ada booked 2 of 3 seats (${tier.seatsLeft} left). Reference: ${adaBooking.reference}`);
try {
  bookTickets(store, tier.id, 'Bayo', 2);
} catch (error) {
  if (error.code !== 'SOLD_OUT') throw error;
  console.log(`Bayo refused for asking for 2 when only ${tier.seatsLeft} is left (${error.code}).`);
}
bookTickets(store, tier.id, 'Chidi', 1);
console.log(`The event is sold out (${tier.seatsLeft} seats left).`);
joinWaitlist(store, tier.id, 'Dara');
joinWaitlist(store, tier.id, 'Emeka');
console.log('Dara and Emeka joined the waitlist.');
console.log(`Found booking by reference: ${findBookingByReference(store, adaBooking.reference).attendeeName}.`);
cancelBooking(store, adaBooking.id);
console.log(`Ada cancelled; ${tier.seatsLeft} seats are free. Next in line: ${store.waitlists.get(tier.id).peek().attendeeName}.`);
