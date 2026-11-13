import { addTier, createEvent, me, publishEvent } from '../api.js';
import { getToken } from '../session.js';
import { el, formatPrice } from '../ui.js';

const feedback = document.querySelector('#organizer-feedback');
const createSection = document.querySelector('#create-event-section');
const createForm = document.querySelector('#create-event-form');
const eventList = document.querySelector('#organizer-events');

function showError(message) {
  feedback.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, message));
}

function parsePrice(value) {
  const cents = Number(value) * 100;
  const rounded = Math.round(cents);
  if (!Number.isFinite(cents) || cents < 0 || Math.abs(cents - rounded) > 1e-8) {
    throw new Error('Enter a non-negative price with no more than two decimal places.');
  }
  return rounded;
}

function eventCard(event) {
  const tierList = el('ul', { className: 'organizer-tier-list' });
  const card = el('article', { className: 'organizer-event-card' }, [
    el('div', { className: 'event-card-top' }, [
      el('span', { className: 'event-city' }, event.city),
      el('span', { className: 'event-date' }, 'Draft'),
    ]),
    el('h2', {}, event.title),
    el('p', { className: 'event-venue' }, `${event.venue} · ${new Date(event.date).toLocaleString()}`),
    tierList,
  ]);
  const tierForm = el('form', {
    className: 'organizer-tier-form',
    action: `/api/events/${encodeURIComponent(event.id)}/tiers`,
    method: 'post',
  }, [
    el('div', { className: 'field' }, [
      el('label', { htmlFor: `tier-name-${event.id}` }, 'Tier name'),
      el('input', { id: `tier-name-${event.id}`, name: 'name', type: 'text', required: true }),
    ]),
    el('div', { className: 'field' }, [
      el('label', { htmlFor: `tier-price-${event.id}` }, 'Price (₦)'),
      el('input', { id: `tier-price-${event.id}`, name: 'price', type: 'number', min: 0, step: '0.01', required: true }),
    ]),
    el('div', { className: 'field' }, [
      el('label', { htmlFor: `tier-capacity-${event.id}` }, 'Capacity'),
      el('input', { id: `tier-capacity-${event.id}`, name: 'capacity', type: 'number', min: 1, step: 1, required: true }),
    ]),
    el('button', { className: 'button button-quiet', type: 'submit' }, 'Add tier'),
  ]);
  const publishButton = el('button', { className: 'button button-primary', type: 'button', disabled: true }, 'Publish event');
  const status = el('p', { className: 'organizer-status', role: 'status' }, 'Add at least one tier before publishing.');

  tierForm.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = tierForm.querySelector('button[type="submit"]');
    const values = new FormData(tierForm);
    button.disabled = true;
    status.textContent = 'Adding ticket tier…';
    try {
      const tier = await addTier(event.id, {
        name: values.get('name'),
        priceCents: parsePrice(values.get('price')),
        capacity: Number(values.get('capacity')),
      });
      tierList.append(el('li', {}, `${tier.name} · ${formatPrice(tier.priceCents)} · ${tier.capacity} seats`));
      tierForm.reset();
      publishButton.disabled = false;
      status.textContent = 'Tier added. You can add another or publish this event.';
    } catch (error) {
      status.replaceChildren(el('span', { className: 'error-message', role: 'alert' }, error.message));
    } finally {
      button.disabled = false;
    }
  });

  publishButton.addEventListener('click', async () => {
    publishButton.disabled = true;
    status.textContent = 'Publishing event…';
    try {
      await publishEvent(event.id);
      tierForm.hidden = true;
      publishButton.hidden = true;
      card.querySelector('.event-date').textContent = 'Published';
      feedback.replaceChildren();
      status.textContent = 'Your event is now visible in Explore.';
    } catch (error) {
      status.replaceChildren(el('span', { className: 'error-message', role: 'alert' }, error.message));
      publishButton.disabled = false;
    }
  });

  card.append(tierForm, publishButton, status);
  return card;
}

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = createForm.querySelector('button[type="submit"]');
  const values = new FormData(createForm);
  button.disabled = true;
  feedback.replaceChildren(el('p', { className: 'loading-message', role: 'status' }, 'Creating your event…'));
  try {
    const created = await createEvent({
      title: values.get('title'),
      city: values.get('city'),
      venue: values.get('venue'),
      date: new Date(values.get('date')).toISOString(),
    });
    eventList.prepend(eventCard(created));
    createForm.reset();
    feedback.replaceChildren(el('p', { className: 'success-message', role: 'status' }, 'Draft created. Add a ticket tier to continue.'));
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
});

async function initialize() {
  feedback.replaceChildren(el('p', { className: 'loading-message', role: 'status' }, 'Checking organizer access…'));
  if (!getToken()) {
    showError('Please log in with an organizer account to manage events.');
    return;
  }
  try {
    const { user } = await me();
    if (user.role !== 'organizer') {
      showError('Only organizer accounts can create and publish events.');
      return;
    }
    feedback.replaceChildren();
    createSection.hidden = false;
  } catch (error) {
    showError(error.message);
  }
}

await initialize();
