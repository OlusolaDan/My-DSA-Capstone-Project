import { createBooking, getEvent, pay } from '../api.js';
import { el, formatEventDate, formatPrice } from '../ui.js';

const eventRoot = document.querySelector('#event-detail');
const checkout = document.querySelector('#checkout');
const checkoutContent = document.querySelector('#checkout-content');
const eventId = new URLSearchParams(window.location.search).get('id');
let countdownTimer;

function showError(container, message) {
  container.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, message));
}

function tierCard(tier) {
  const soldOut = tier.seatsLeft <= 0;
  const quantity = el('input', {
    id: `quantity-${tier.id}`,
    name: 'quantity',
    type: 'number',
    min: 1,
    max: Math.min(10, tier.seatsLeft),
    value: 1,
    required: true,
    disabled: soldOut,
  });
  const quantityLabel = el('label', { htmlFor: quantity.id }, 'Quantity');
  const status = soldOut
    ? el('span', { className: 'status-pill sold-out' }, 'Sold out')
    : el('span', { className: 'seats-remaining' }, `${tier.seatsLeft} ${tier.seatsLeft === 1 ? 'seat' : 'seats'} left`);
  const form = el('form', { className: 'tier-booking-form' }, [
    el('div', { className: 'quantity-field' }, [quantityLabel, quantity]),
    el('button', { className: 'button button-dark', type: 'submit', disabled: soldOut }, soldOut ? 'Sold out' : 'Reserve seats'),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requested = Number(quantity.value);
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > Math.min(10, tier.seatsLeft)) {
      showError(form, `Choose between 1 and ${Math.min(10, tier.seatsLeft)} tickets.`);
      return;
    }
    form.querySelector('[role="alert"]')?.remove();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const booking = await createBooking(tier.id, requested);
      renderCheckout(booking, tier.name);
      await renderEvent();
      checkout.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showError(form, error.message);
    } finally {
      button.disabled = soldOut;
    }
  });

  return el('article', { className: `tier-card${soldOut ? ' tier-sold-out' : ''}` }, [
    el('div', { className: 'tier-details' }, [
      el('div', {}, [el('h3', {}, tier.name), status]),
      el('p', { className: 'tier-price' }, formatPrice(tier.priceCents)),
    ]),
    form,
  ]);
}

function renderCheckout(booking, tierName) {
  checkout.hidden = false;
  const expiresAt = Date.parse(booking.holdExpiresAt);
  const countdown = el('p', { className: 'hold-countdown', role: 'status', 'aria-live': 'polite' });
  const errorRegion = el('div', { className: 'checkout-feedback' });
  const expiredLink = el('a', { className: 'button button-quiet', href: `./event.html?id=${encodeURIComponent(booking.eventId)}` }, 'Choose tickets again');
  const form = el('form', { className: 'checkout-form' });
  const decline = el('input', { id: 'simulate-decline', name: 'decline', type: 'checkbox' });
  const declineLabel = el('label', { htmlFor: decline.id }, 'Simulate a declined card (demo only)');
  const payButton = el('button', { className: 'button button-primary', type: 'submit' }, `Pay ${formatPrice(booking.totalCents)}`);
  form.append(
    el('div', { className: 'checkout-summary' }, [
      el('span', {}, `${booking.quantity} × ${tierName}`),
      el('strong', {}, formatPrice(booking.totalCents)),
    ]),
    el('div', { className: 'demo-payment-field' }, [decline, declineLabel]),
    payButton,
  );

  const updateCountdown = () => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, '0');
    if (remaining === 0) {
      countdown.textContent = 'Your seat hold has expired. Choose tickets again to continue.';
      payButton.disabled = true;
      expiredLink.hidden = false;
      clearInterval(countdownTimer);
    } else {
      countdown.textContent = `Your seats are held for ${minutes}:${seconds}.`;
      expiredLink.hidden = true;
    }
  };

  updateCountdown();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdown, 1000);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorRegion.replaceChildren();
    payButton.disabled = true;
    try {
      const paid = await pay(booking.reference, { decline: decline.checked });
      clearInterval(countdownTimer);
      checkoutContent.replaceChildren(
        el('div', { className: 'payment-success', role: 'status' }, [
          el('span', { className: 'success-mark', 'aria-hidden': 'true' }, '✓'),
          el('p', { className: 'eyebrow' }, 'You’re all set'),
          el('h3', {}, 'Your place is confirmed.'),
          el('p', {}, `Booking reference: ${paid.reference}`),
        ]),
      );
    } catch (error) {
      showError(errorRegion, error.message);
      payButton.disabled = Date.now() >= expiresAt;
    } finally {
      if (!checkoutContent.querySelector('.payment-success') && Date.now() < expiresAt) {
        payButton.disabled = false;
      }
    }
  });

  checkoutContent.replaceChildren(
    countdown,
    el('p', { className: 'checkout-note' }, 'Demo checkout only. No real card details are collected.'),
    errorRegion,
    form,
    expiredLink,
  );
}

async function renderEvent() {
  if (!eventId) {
    eventRoot.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, 'No event was selected.'));
    eventRoot.setAttribute('aria-busy', 'false');
    return;
  }
  try {
    const event = await getEvent(eventId);
    document.title = `${event.title} | Gather`;
    eventRoot.replaceChildren(
      el('section', { className: 'event-intro' }, [
        el('p', { className: 'eyebrow' }, `${event.city} · ${formatEventDate(event.date)}`),
        el('h1', {}, event.title),
        el('p', { className: 'event-location' }, event.venue),
      ]),
      el('section', { className: 'ticket-section', 'aria-labelledby': 'tickets-heading' }, [
        el('div', { className: 'section-heading' }, [
          el('div', {}, [el('p', { className: 'eyebrow' }, 'Save your spot'), el('h2', { id: 'tickets-heading' }, 'Choose your tickets')]),
        ]),
        el('div', { className: 'tier-list' }, event.tiers.map(tierCard)),
      ]),
    );
  } catch (error) {
    eventRoot.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, error.message));
  } finally {
    eventRoot.setAttribute('aria-busy', 'false');
  }
}

await renderEvent();
