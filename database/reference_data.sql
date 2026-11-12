-- Required pricing lookup rows. Run after schema.sql on a new installation.
-- Existing installations should run migrations/001_booking_compatibility.sql.

INSERT INTO TICKET_TYPE (type, ticket_discount)
SELECT 'Regular', 0.00
WHERE NOT EXISTS (SELECT 1 FROM TICKET_TYPE WHERE LOWER(type) = 'regular');

INSERT INTO TICKET_TYPE (type, ticket_discount)
SELECT 'Senior', 20.00
WHERE NOT EXISTS (SELECT 1 FROM TICKET_TYPE WHERE LOWER(type) = 'senior');

INSERT INTO TICKET_TYPE (type, ticket_discount)
SELECT 'PWD', 20.00
WHERE NOT EXISTS (SELECT 1 FROM TICKET_TYPE WHERE LOWER(type) = 'pwd');
