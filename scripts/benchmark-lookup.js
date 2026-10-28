import { performance } from 'node:perf_hooks';

const BOOKINGS = 100_000;
const LOOKUPS = 500;
const bookings = Array.from({ length: BOOKINGS }, (_, index) => ({ reference: `ET-${index}` }));
const byReference = new Map(bookings.map((booking) => [booking.reference, booking]));
const targets = Array.from({ length: LOOKUPS }, (_, index) => `ET-${(index * 197) % BOOKINGS}`);

let start = performance.now();
for (const reference of targets) bookings.find((booking) => booking.reference === reference);
const arrayMs = performance.now() - start;

start = performance.now();
for (const reference of targets) byReference.get(reference);
const mapMs = performance.now() - start;

console.log(`Array.find (${BOOKINGS.toLocaleString()} bookings, ${LOOKUPS} lookups): ${arrayMs.toFixed(3)} ms`);
console.log(`Map.get    (${BOOKINGS.toLocaleString()} bookings, ${LOOKUPS} lookups): ${mapMs.toFixed(3)} ms`);
