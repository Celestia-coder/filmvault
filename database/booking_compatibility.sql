USE filmvault;

-- =============================================
-- HELPER: ADD MISSING COLUMNS
-- =============================================

-- 1. SEATBOOKING: held_by

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seatbooking'
      AND COLUMN_NAME = 'held_by'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE SEATBOOKING ADD COLUMN held_by INT NULL',
    'SELECT "held_by already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 2. TOTAL_PURCHASE: payment_status

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND COLUMN_NAME = 'payment_status'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE TOTAL_PURCHASE
     ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT ''pending''',
    'SELECT "payment_status already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 3. TOTAL_PURCHASE: discount_type

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND COLUMN_NAME = 'discount_type'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE TOTAL_PURCHASE
     ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT ''none''',
    'SELECT "discount_type already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 4. TOTAL_PURCHASE: id_image_url

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND COLUMN_NAME = 'id_image_url'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE TOTAL_PURCHASE
     ADD COLUMN id_image_url VARCHAR(255) NULL',
    'SELECT "id_image_url already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 5. TOTAL_PURCHASE: reference_code

SET @exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND COLUMN_NAME = 'reference_code'
);

SET @sql = IF(
    @exists = 0,
    'ALTER TABLE TOTAL_PURCHASE
     ADD COLUMN reference_code VARCHAR(100) NULL',
    'SELECT "reference_code already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================
-- ADD FOREIGN KEY TO SEATBOOKING
-- =============================================

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seatbooking'
      AND CONSTRAINT_NAME = 'fk_seatbooking_user'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(
    @fk_exists = 0,
    'ALTER TABLE SEATBOOKING
     ADD CONSTRAINT fk_seatbooking_user
     FOREIGN KEY (held_by)
     REFERENCES `user`(user_id)
     ON DELETE SET NULL',
    'SELECT "Seatbooking foreign key already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================
-- ADD UNIQUE INDEX TO reference_code
-- =============================================

SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'total_purchase'
      AND INDEX_NAME = 'uq_purchase_reference'
);

SET @sql = IF(
    @index_exists = 0,
    'CREATE UNIQUE INDEX uq_purchase_reference
     ON TOTAL_PURCHASE (reference_code)',
    'SELECT "Reference code index already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================
-- INSERT MISSING TICKET TYPES
-- =============================================

INSERT INTO TICKET_TYPE (type, ticket_discount)
SELECT 'Regular', 0.00
WHERE NOT EXISTS (
    SELECT 1 FROM TICKET_TYPE WHERE type = 'Regular'
);

INSERT INTO TICKET_TYPE (type, ticket_discount)
SELECT 'Senior', 20.00
WHERE NOT EXISTS (
    SELECT 1 FROM TICKET_TYPE WHERE type = 'Senior'
);

INSERT INTO TICKET_TYPE (type, ticket_discount)
SELECT 'PWD', 20.00
WHERE NOT EXISTS (
    SELECT 1 FROM TICKET_TYPE WHERE type = 'PWD'
);


-- =============================================
-- INSERT TEST CUSTOMER IF NOT EXISTS
-- Password: Tester123!
-- =============================================

INSERT INTO `user`
    (branch_id, role, email, username, password, name, phone_num)
SELECT
    NULL,
    'customer',
    'tester@filmvault.com',
    'tester',
    '$2b$10$mo1ogcGDNQxeEwqhV9CyheM5y4gmv/o4Bgf1xwIA7degpbuh3Zdni',
    'Test Customer',
    '09170000000'
WHERE NOT EXISTS (
    SELECT 1
    FROM `user`
    WHERE email = 'tester@filmvault.com'
       OR username = 'tester'
);


-- =============================================
-- UPDATE PAYMENT STATUS
-- =============================================

SET SQL_SAFE_UPDATES = 0;

UPDATE TOTAL_PURCHASE
SET payment_status = 'paid'
WHERE status = 'confirmed';

SET SQL_SAFE_UPDATES = 1;


-- =============================================
-- VERIFY ALL CHANGES
-- =============================================

SELECT 'SEATBOOKING STRUCTURE' AS verification;
DESCRIBE SEATBOOKING;

SELECT 'TOTAL_PURCHASE STRUCTURE' AS verification;
DESCRIBE TOTAL_PURCHASE;

SELECT 'TICKET TYPES' AS verification;
SELECT * FROM TICKET_TYPE;

SELECT 'TEST CUSTOMER' AS verification;
SELECT user_id, username, email, role
FROM `user`
WHERE username = 'tester';

SELECT 'PURCHASE RECORDS' AS verification;
SELECT
    purchase_id,
    user_id,
    status,
    payment_status,
    discount_type,
    reference_code
FROM TOTAL_PURCHASE;

SHOW INDEX FROM SEATBOOKING;
SHOW INDEX FROM TOTAL_PURCHASE;


-- FOR UPDATING THE ADMIN ACCOUNT

SELECT user_id, email, role, branch_id FROM USER WHERE role = 'admin';

UPDATE USER
SET password = '$2b$10$mo1ogcGDNQxeEwqhV9CyheM5y4gmv/o4Bgf1xwIA7degpbuh3Zdni'
WHERE user_id = 1;