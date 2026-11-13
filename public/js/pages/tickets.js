import { cancelBooking, getEvent, listBookings, me } from '../api.js';
import { clearToken, getToken } from '../session.js';
import { el, formatPrice } from '../ui.js';

const root = document.querySelector('#ticket-list');

function loginLink() {
  return el('p', {}, [
    'Please ',
    el('a', { href: './login.html?next=%2Ftickets.html' }, 'log in'),
    ' to view your tickets.',
  ]);
}

function bookingCard(booking, event, tier) {
  const card = el('article', { className: 'booking-card' }, [
    el('p', { className: 'eyebrow' }, booking.status),
    el('h2', {}, `Booking ${booking.reference}`),
    el('dl', { className: 'booking-details' }, [
      el('div', {}, [el('dt', {}, 'Event'), el('dd', {}, [
        el('a', { href: `./event.html?id=${encodeURIComponent(event.id)}` }, event.title),
      ])]),
      el('div', {}, [el('dt', {}, 'Tier'), el('dd', {}, tier?.name ?? 'Ticket tier')]),
      el('div', {}, [el('dt', {}, 'Tickets'), el('dd', {}, booking.quantity)]),
      el('div', {}, [el('dt', {}, 'Total'), el('dd', {}, formatPrice(booking.totalCents))]),
    ]),
  ]);

  if (booking.status === 'pending') {
    const cancel = el('button', { className: 'button button-quiet', type: 'button' }, 'Cancel booking');
    cancel.addEventListener('click', async () => {
      cancel.disabled = true;
      try {
        await cancelBooking(booking.reference);
        await renderTickets();
      } catch (error) {
        card.append(el('p', { className: 'error-message', role: 'alert' }, error.message));
        cancel.disabled = false;
      }
    });
    card.append(cancel);
  }
  return card;
}

async function renderTickets() {
  root.setAttribute('aria-busy', 'true');
  root.replaceChildren(el('p', { className: 'loading-message', role: 'status' }, 'Loading your tickets…'));
  try {
    if (!getToken()) {
      root.replaceChildren(loginLink());
      return;
    }
    const [{ user }, bookings] = await Promise.all([me(), listBookings()]);
    if (user.role !== 'attendee') {
      root.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, 'This page is for attendee accounts.'));
      return;
    }
    if (bookings.length === 0) {
      root.replaceChildren(el('p', { className: 'empty-state' }, 'You do not have any bookings yet.'));
      return;
    }
    const details = await Promise.all(bookings.map(async (booking) => {
      const event = await getEvent(booking.eventId);
      return bookingCard(booking, event, event.tiers.find((tier) => tier.id === booking.tierId));
    }));
    root.replaceChildren(...details);
  } catch (error) {
    if (error.code === 'UNAUTHENTICATED') clearToken();
    root.replaceChildren(
      el('p', { className: 'error-message', role: 'alert' }, error.message),
      loginLink(),
    );
  } finally {
    root.setAttribute('aria-busy', 'false');
  }
}

await renderTickets();
