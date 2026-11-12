-- MySQL 8.0. Apply only to an existing FilmVault database.
-- Before sourcing this file, select the target database and set
-- @filmvault_target_schema to its exact name in the same SQL session.
-- Run in stop-on-error batch mode, never with --force.

SET @filmvault_guard_sql = IF(
    @filmvault_target_schema IS NOT NULL
        AND BINARY DATABASE() = BINARY @filmvault_target_schema,
    'SELECT 1',
    'FILMVAULT_TARGET_MISMATCH_STOP'
);
PREPARE filmvault_guard FROM @filmvault_guard_sql;
EXECUTE filmvault_guard;
DEALLOCATE PREPARE filmvault_guard;

-- Do not replace a routine left by another process or an interrupted run.
SET @filmvault_routine_guard_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = DATABASE()
          AND routine_type = 'PROCEDURE'
          AND LOWER(routine_name) = 'filmvault_migrate_booking_001'
    ),
    'FILMVAULT_MIGRATION_ROUTINE_EXISTS_STOP',
    'SELECT 1'
);
PREPARE filmvault_routine_guard FROM @filmvault_routine_guard_sql;
EXECUTE filmvault_routine_guard;
DEALLOCATE PREPARE filmvault_routine_guard;

DELIMITER $$

CREATE PROCEDURE filmvault_migrate_booking_001()
BEGIN
    DECLARE v_schema VARCHAR(64);
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_held_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_ref_exists BOOLEAN DEFAULT FALSE;

    SET v_schema = DATABASE();
    IF v_schema IS NULL OR @filmvault_target_schema IS NULL
       OR BINARY v_schema <> BINARY @filmvault_target_schema THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FilmVault migration target mismatch';
    END IF;

    SELECT COUNT(DISTINCT LOWER(table_name)) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = v_schema AND table_type = 'BASE TABLE'
      AND LOWER(table_name) IN ('user', 'seatbooking', 'total_purchase', 'ticket_type');
    IF v_count <> 4 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Required FilmVault tables are missing';
    END IF;

    -- Existing columns must already have compatible types. Do not silently
    -- change a populated column or reinterpret historical values.
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = v_schema AND (
        (LOWER(table_name) = 'seatbooking' AND column_name = 'held_by'
            AND (column_type <> 'int' OR is_nullable <> 'YES'))
        OR (LOWER(table_name) = 'total_purchase' AND column_name = 'reference_code'
            AND column_type <> 'varchar(100)')
        OR (LOWER(table_name) = 'total_purchase' AND column_name = 'payment_status'
            AND column_type <> 'varchar(20)')
        OR (LOWER(table_name) = 'total_purchase' AND column_name = 'discount_type'
            AND column_type <> 'varchar(20)')
        OR (LOWER(table_name) = 'total_purchase' AND column_name = 'id_image_url'
            AND (column_type <> 'varchar(255)' OR is_nullable <> 'YES'))
    );
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Existing booking column has an incompatible type';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND LOWER(table_name) = 'seatbooking'
          AND column_name = 'held_by'
    ) INTO v_held_exists;
    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND LOWER(table_name) = 'total_purchase'
          AND column_name = 'reference_code'
    ) INTO v_ref_exists;

    IF v_held_exists THEN
        SELECT COUNT(*) INTO v_count
        FROM SEATBOOKING sb LEFT JOIN `USER` u ON u.user_id = sb.held_by
        WHERE sb.held_by IS NOT NULL AND u.user_id IS NULL;
        IF v_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Orphaned seat hold owners must be reviewed';
        END IF;
    END IF;

    IF v_ref_exists THEN
        SELECT COUNT(*) INTO v_count FROM (
            SELECT reference_code FROM TOTAL_PURCHASE
            WHERE reference_code IS NOT NULL
            GROUP BY reference_code HAVING COUNT(*) > 1
        ) duplicate_references;
        IF v_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duplicate purchase references must be reviewed';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_count FROM (
        SELECT LOWER(type) FROM TICKET_TYPE
        GROUP BY LOWER(type) HAVING COUNT(*) > 1
    ) duplicate_types;
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duplicate ticket type names must be reviewed';
    END IF;

    SELECT COUNT(*) INTO v_count FROM TICKET_TYPE
    WHERE (LOWER(type) = 'regular' AND (ticket_discount IS NULL OR ticket_discount <> 0.00))
       OR (LOWER(type) IN ('senior', 'pwd')
           AND (ticket_discount IS NULL OR ticket_discount <> 20.00));
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Existing ticket discounts require review';
    END IF;

    -- Reject conflicting names or foreign-key targets before any DDL.
    SELECT COUNT(*) INTO v_count
    FROM information_schema.key_column_usage
    WHERE table_schema = v_schema AND LOWER(table_name) = 'seatbooking'
      AND column_name = 'held_by' AND referenced_table_name IS NOT NULL
      AND NOT (LOWER(referenced_table_name) = 'user' AND referenced_column_name = 'user_id');
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'held_by has an unexpected foreign key';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.key_column_usage k
    JOIN information_schema.referential_constraints r
      ON r.constraint_schema = k.constraint_schema
     AND r.constraint_name = k.constraint_name
    WHERE k.table_schema = v_schema AND LOWER(k.table_name) = 'seatbooking'
      AND k.column_name = 'held_by' AND LOWER(k.referenced_table_name) = 'user'
      AND k.referenced_column_name = 'user_id' AND r.delete_rule <> 'SET NULL';
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'held_by foreign key needs ON DELETE SET NULL';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.table_constraints
    WHERE constraint_schema = v_schema
      AND LOWER(constraint_name) = 'fk_seatbooking_user'
      AND NOT (LOWER(table_name) = 'seatbooking' AND constraint_type = 'FOREIGN KEY');
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seat hold constraint name is occupied in this schema';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.key_column_usage
    WHERE table_schema = v_schema AND LOWER(table_name) = 'seatbooking'
      AND constraint_name = 'fk_seatbooking_user'
      AND NOT (column_name = 'held_by'
          AND LOWER(referenced_table_name) = 'user'
          AND referenced_column_name = 'user_id');
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seat hold constraint name is occupied';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.statistics
    WHERE table_schema = v_schema AND LOWER(table_name) = 'total_purchase'
      AND index_name = 'uq_purchase_reference'
      AND (non_unique <> 0 OR column_name <> 'reference_code' OR sub_part IS NOT NULL);
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Purchase reference index name is occupied';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM information_schema.statistics
    WHERE table_schema = v_schema AND LOWER(table_name) = 'ticket_type'
      AND index_name = 'uq_ticket_type_name'
      AND (non_unique <> 0 OR column_name <> 'type' OR sub_part IS NOT NULL);
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ticket type index name is occupied';
    END IF;

    -- Add only missing structure. Nullable legacy columns leave historical
    -- payment, discount and reference facts unknown; new bookings supply values.
    IF NOT v_held_exists THEN
        ALTER TABLE SEATBOOKING ADD COLUMN held_by INT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage
        WHERE table_schema = v_schema AND LOWER(table_name) = 'seatbooking'
          AND column_name = 'held_by' AND LOWER(referenced_table_name) = 'user'
          AND referenced_column_name = 'user_id'
    ) THEN
        ALTER TABLE SEATBOOKING
            ADD CONSTRAINT fk_seatbooking_user
            FOREIGN KEY (held_by) REFERENCES `USER`(user_id) ON DELETE SET NULL;
    END IF;

    IF NOT v_ref_exists THEN
        ALTER TABLE TOTAL_PURCHASE ADD COLUMN reference_code VARCHAR(100) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM (
            SELECT index_name FROM information_schema.statistics
            WHERE table_schema = v_schema AND LOWER(table_name) = 'total_purchase'
            GROUP BY index_name
            HAVING MAX(non_unique) = 0 AND COUNT(*) = 1
               AND MAX(sub_part IS NOT NULL) = 0
               AND MAX(column_name = 'reference_code') = 1
        ) unique_reference_indexes
    ) THEN
        CREATE UNIQUE INDEX uq_purchase_reference ON TOTAL_PURCHASE (reference_code);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND LOWER(table_name) = 'total_purchase'
          AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE TOTAL_PURCHASE ADD COLUMN payment_status VARCHAR(20) NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND LOWER(table_name) = 'total_purchase'
          AND column_name = 'discount_type'
    ) THEN
        ALTER TABLE TOTAL_PURCHASE ADD COLUMN discount_type VARCHAR(20) NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND LOWER(table_name) = 'total_purchase'
          AND column_name = 'id_image_url'
    ) THEN
        ALTER TABLE TOTAL_PURCHASE ADD COLUMN id_image_url VARCHAR(255) NULL DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM (
            SELECT index_name FROM information_schema.statistics
            WHERE table_schema = v_schema AND LOWER(table_name) = 'ticket_type'
            GROUP BY index_name
            HAVING MAX(non_unique) = 0 AND COUNT(*) = 1
               AND MAX(sub_part IS NOT NULL) = 0
               AND MAX(column_name = 'type') = 1
        ) unique_type_indexes
    ) THEN
        CREATE UNIQUE INDEX uq_ticket_type_name ON TICKET_TYPE (type);
    END IF;

    INSERT INTO TICKET_TYPE (type, ticket_discount)
    SELECT 'Regular', 0.00
    WHERE NOT EXISTS (SELECT 1 FROM TICKET_TYPE WHERE LOWER(type) = 'regular');

    INSERT INTO TICKET_TYPE (type, ticket_discount)
    SELECT 'Senior', 20.00
    WHERE NOT EXISTS (SELECT 1 FROM TICKET_TYPE WHERE LOWER(type) = 'senior');

    INSERT INTO TICKET_TYPE (type, ticket_discount)
    SELECT 'PWD', 20.00
    WHERE NOT EXISTS (SELECT 1 FROM TICKET_TYPE WHERE LOWER(type) = 'pwd');
END$$

CALL filmvault_migrate_booking_001()$$
DROP PROCEDURE filmvault_migrate_booking_001$$

DELIMITER ;
