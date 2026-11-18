-- Apply once after schema.sql and email_local_test_catalog.sql on a new,
-- separately approved disposable database. Never run on a team database.
USE `filmvault_email_local_test`;

-- Current checkout requires these columns even when email QR is disabled.
ALTER TABLE SEATBOOKING
  ADD COLUMN held_by INT NULL,
  ADD CONSTRAINT fk_seatbooking_user
    FOREIGN KEY (held_by) REFERENCES `USER`(user_id) ON DELETE SET NULL;

ALTER TABLE TOTAL_PURCHASE
  ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN id_image_url VARCHAR(255) NULL,
  ADD COLUMN reference_code VARCHAR(100) NULL,
  ADD COLUMN verification_token CHAR(32) NULL;

CREATE UNIQUE INDEX uq_purchase_reference ON TOTAL_PURCHASE (reference_code);
CREATE UNIQUE INDEX uq_total_purchase_verification_token
  ON TOTAL_PURCHASE (verification_token);

INSERT INTO TICKET_TYPE (type, ticket_discount)
VALUES ('Regular', 0.00), ('Senior', 20.00), ('PWD', 20.00);

-- The catalog's fixed example dates may expire. Add one future screening only
-- when the seeded catalog has no future scheduled screening.
INSERT INTO SCREENING
  (movie_id, cinema_id, show_date, show_time, total_seats, booked_seats, status)
SELECT m.movie_id, c.cinema_id, CURRENT_DATE() + INTERVAL 30 DAY,
       '18:30:00', COUNT(se.seat_id), 0, 'scheduled'
FROM MOVIE m
JOIN CINEMA c ON c.cinema_id = 1
JOIN SEAT se ON se.cinema_id = c.cinema_id AND se.seat_status = 'active'
WHERE m.movie_id = 2 AND m.status = 'now-showing'
  AND NOT EXISTS (
    SELECT 1 FROM SCREENING s
    WHERE s.status = 'scheduled' AND s.show_date > CURRENT_DATE()
  )
GROUP BY m.movie_id, c.cinema_id;
