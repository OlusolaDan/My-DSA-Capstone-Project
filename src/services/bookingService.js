import { DomainError } from '../domain/errors.js';
import { newId, newReference } from '../domain/ids.js';
import { assertTransition } from '../domain/bookingStateMachine.js';

const requiredText = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('VALIDATION', `${name} must be a non-empty string`);
  return value.trim();
};

export function createBookingService(repository, paymentGateway) {
  return {
    async book({ tierId, quantity }, userId) {
      userId = requiredText(userId, 'x-user-id');
      requiredText(tierId, 'tierId');
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw new DomainError('VALIDATION', 'quantity must be a whole number from 1 to 10');
      const tier = await repository.getTier(tierId);
      const event = await repository.getEvent(tier.eventId);
      if (event.status !== 'published') throw new DomainError('INVALID_STATE', 'Tickets can only be booked for a published event');
      if (tier.seatsLeft < quantity) throw new DomainError('SOLD_OUT', 'Not enough seats remain');
      const totalCents = tier.priceCents * quantity;
      if (!Number.isSafeInteger(totalCents)) throw new DomainError('VALIDATION', 'Booking total exceeds the supported whole-cent range');
      tier.seatsLeft -= quantity; tier.sold += quantity;
      await repository.updateTier(tier);
      return repository.createBooking({ id: newId(), reference: newReference(), eventId: event.id, tierId, userId, quantity, totalCents, status: 'pending' });
    },
    async pay(reference, userId, { decline = false } = {}) {
      userId = requiredText(userId, 'x-user-id');
      const booking = await repository.getBookingByReference(requiredText(reference, 'reference'));
      if (booking.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the attendee who made the booking can pay for it');
      assertTransition(booking.status, 'paid');
      const result = await paymentGateway.charge({ amountCents: booking.totalCents, decline: Boolean(decline) });
      if (!result.success) throw new DomainError('PAYMENT_DECLINED', 'Mock payment was declined');
      booking.status = 'paid';
      return repository.updateBooking(booking);
    },
    async cancel(reference, userId) {
      userId = requiredText(userId, 'x-user-id');
      const booking = await repository.getBookingByReference(requiredText(reference, 'reference'));
      if (booking.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the attendee who made the booking can cancel it');
      if (booking.status !== 'pending') throw new DomainError('INVALID_TRANSITION', 'Only pending bookings can be cancelled in this build');
      assertTransition(booking.status, 'cancelled');
      booking.status = 'cancelled'; await repository.updateBooking(booking);
      const tier = await repository.getTier(booking.tierId);
      tier.sold -= booking.quantity; tier.seatsLeft += booking.quantity;
      await repository.updateTier(tier);
      return booking;
    },
  };
}
