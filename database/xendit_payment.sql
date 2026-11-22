-- Xendit payments: stores the paid invoice id on the booking.
-- UNIQUE so one paid invoice can never confirm two bookings.
-- Run once on databases that will use PAYMENT_PROVIDER=xendit.
ALTER TABLE TOTAL_PURCHASE
    ADD COLUMN payment_ref VARCHAR(100) NULL,
    ADD UNIQUE KEY uq_total_purchase_payment_ref (payment_ref);
