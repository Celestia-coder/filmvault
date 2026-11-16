USE filmvault;

-- =============================================
-- QR TICKET VERIFICATION
-- Adds TOTAL_PURCHASE.verification_token: a random, unguessable token that the
-- e-ticket QR code points to (/verify/<token>). Safe to run more than once.
-- =============================================

-- 1. Column

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND COLUMN_NAME = 'verification_token'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE TOTAL_PURCHASE ADD COLUMN verification_token CHAR(32) NULL',
    'SELECT "verification_token already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 2. Backfill existing bookings (RANDOM_BYTES is cryptographically secure)

SET SQL_SAFE_UPDATES = 0;

UPDATE TOTAL_PURCHASE
SET verification_token = LOWER(HEX(RANDOM_BYTES(16)))
WHERE verification_token IS NULL;

SET SQL_SAFE_UPDATES = 1;


-- 3. Unique index (also makes the token lookup fast)

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND INDEX_NAME = 'uq_total_purchase_verification_token'
);

SET @sql = IF(
    @exists = 0,
    'CREATE UNIQUE INDEX uq_total_purchase_verification_token
     ON TOTAL_PURCHASE (verification_token)',
    'SELECT "uq_total_purchase_verification_token already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- Verification
SELECT purchase_id, reference_code, status, payment_status, verification_token
FROM TOTAL_PURCHASE
ORDER BY purchase_id DESC
LIMIT 10;
