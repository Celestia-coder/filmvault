// utils/pricing.js
// Server-side price calculation. The server is the only source of truth for
// total_price: whatever total the Checkout page displays, this is what is
// charged and stored.
//
// All maths is done in whole centavos (integers) and converted back at the
// end, so totals never pick up floating point noise like 279.99999999.

// Mirrors the Checkout page (BOOKING_FEE_PER_TICKET). Charged per ticket and
// never discounted. TODO: confirm the real amount with the team.
const BOOKING_FEE_PER_TICKET_CENTS = 30 * 100;

const toCents = (pesos) => Math.round(Number(pesos) * 100);
const toPesos = (cents) => Number((cents / 100).toFixed(2));

// seats: [{ seatId, type, freeTicket? }]   type = "regular" | "senior" | "pwd"
//   freeTicket: true makes that ticket free AND waives its booking fee
//   (the Taguig senior promo, see utils/seniorFreeTicket.js). The caller decides
//   who qualifies; this function only does the maths.
// discountPercentByType: { senior: 20, pwd: 20 }   (from TICKET_TYPE.ticket_discount)
// snacks: [{ snackId, quantity, unitPriceCents }]   (prices from the SNACK table)
// Snacks are never discounted. The booking fee is never discounted either, except
// that it is waived together with a free ticket.
const calculatePrice = ({ basePrice, seats, discountPercentByType, snacks = [] }) => {
  const baseCents = toCents(basePrice);

  const tickets = seats.map(({ seatId, type, freeTicket = false }) => {
    const percent = Number(discountPercentByType[type] ?? 0);
    const priceCents = freeTicket
      ? 0
      : baseCents - Math.round((baseCents * percent) / 100);
    return { seatId, type, freeTicket, priceCents };
  });

  const ticketsTotalCents = tickets.reduce((sum, t) => sum + t.priceCents, 0);
  const bookingFeeCents =
    tickets.filter((t) => !t.freeTicket).length * BOOKING_FEE_PER_TICKET_CENTS;

  const pricedSnacks = snacks.map(({ snackId, quantity, unitPriceCents }) => ({
    snackId,
    quantity,
    subtotal: toPesos(unitPriceCents * quantity),
  }));
  const snacksTotalCents = snacks.reduce((sum, s) => sum + s.unitPriceCents * s.quantity, 0);

  return {
    tickets,
    snacks: pricedSnacks,
    ticketsTotal: toPesos(ticketsTotalCents),
    snacksTotal: toPesos(snacksTotalCents),
    bookingFee: toPesos(bookingFeeCents),
    total: toPesos(ticketsTotalCents + snacksTotalCents + bookingFeeCents),
  };
};

module.exports = { calculatePrice, toCents, toPesos, BOOKING_FEE_PER_TICKET_CENTS };
