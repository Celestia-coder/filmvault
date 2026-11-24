const test = require("node:test");
const assert = require("node:assert/strict");
const { isSeniorFreeScreening } = require("../utils/seniorFreeTicket");
const { calculatePrice } = require("../utils/pricing");

// 2026-11-23 is a Monday, 2026-11-24 a Tuesday, 2026-11-25 a Wednesday.
const screening = (overrides = {}) => ({
  showDate: "2026-11-24",
  showTime: "13:00:00",
  cinemaNum: 1,
  ...overrides,
});

test("Monday and Tuesday 1:00 PM in Cinema 1 and Cinema 2 are part of the promo", () => {
  for (const showDate of ["2026-11-23", "2026-11-24"]) {
    for (const cinemaNum of [1, 2]) {
      assert.equal(isSeniorFreeScreening(screening({ showDate, cinemaNum })), true);
    }
  }
});

test("other days, times and cinemas are not part of the promo", () => {
  const notPromo = [
    { showDate: "2026-11-25" }, // Wednesday
    { showDate: "2026-11-29" }, // Sunday
    { showTime: "16:00:00" }, // not the first screening
    { showTime: "10:00:00" },
    { cinemaNum: 3 },
    { cinemaNum: undefined },
    { showDate: "not a date" },
    { showTime: null },
  ];
  for (const overrides of notPromo) {
    assert.equal(isSeniorFreeScreening(screening(overrides)), false, JSON.stringify(overrides));
  }
});

test("a time without seconds and a Date object are read the same way", () => {
  assert.equal(isSeniorFreeScreening(screening({ showTime: "13:00" })), true);
  assert.equal(isSeniorFreeScreening(screening({ showDate: new Date(2026, 10, 24) })), true);
});

const discounts = { senior: 20, pwd: 20, regular: 0 };

test("a Taguig senior on the promo pays nothing, not even the booking fee", () => {
  const price = calculatePrice({
    basePrice: 350,
    seats: [{ seatId: 1, type: "senior", freeTicket: true }],
    discountPercentByType: discounts,
  });
  assert.equal(price.ticketsTotal, 0);
  assert.equal(price.bookingFee, 0);
  assert.equal(price.total, 0);
});

test("a senior who is not from Taguig gets 20% off and still pays the booking fee", () => {
  const price = calculatePrice({
    basePrice: 350,
    seats: [{ seatId: 1, type: "senior" }],
    discountPercentByType: discounts,
  });
  assert.equal(price.ticketsTotal, 280);
  assert.equal(price.bookingFee, 30);
  assert.equal(price.total, 310);
});

test("in a mixed booking only the free seat loses its fee, and snacks are still charged", () => {
  const price = calculatePrice({
    basePrice: 350,
    seats: [
      { seatId: 1, type: "senior", freeTicket: true },
      { seatId: 2, type: "senior" },
      { seatId: 3, type: "regular" },
    ],
    discountPercentByType: discounts,
    snacks: [{ snackId: 1, quantity: 2, unitPriceCents: 12000 }],
  });
  assert.deepEqual(
    price.tickets.map((t) => t.priceCents),
    [0, 28000, 35000],
  );
  assert.equal(price.ticketsTotal, 630);
  assert.equal(price.bookingFee, 60); // two paying tickets
  assert.equal(price.snacksTotal, 240);
  assert.equal(price.total, 930);
});
