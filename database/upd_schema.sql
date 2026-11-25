CREATE DATABASE filmvault
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE filmvault;

-- =====================================================================
-- 1. LOCATIONS
-- =====================================================================

CREATE TABLE BRANCH (
    branch_id   INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,

    CONSTRAINT uq_branch_name UNIQUE (branch_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CINEMA (
    cinema_id  INT AUTO_INCREMENT PRIMARY KEY,
    branch_id  INT NOT NULL,
    cinema_num INT NOT NULL,

    CONSTRAINT uq_cinema_branch_num UNIQUE (branch_id, cinema_num),
    CONSTRAINT fk_cinema_branch
        FOREIGN KEY (branch_id) REFERENCES BRANCH (branch_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SEAT (
    seat_id     INT AUTO_INCREMENT PRIMARY KEY,
    cinema_id   INT NOT NULL,
    row_num     INT NOT NULL,
    seat_num    INT NOT NULL,
    seat_status VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT uq_seat_position UNIQUE (cinema_id, row_num, seat_num),
    CONSTRAINT fk_seat_cinema
        FOREIGN KEY (cinema_id) REFERENCES CINEMA (cinema_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. LOOKUP TABLES
-- =====================================================================

CREATE TABLE GENRE (
    genre_id   INT AUTO_INCREMENT PRIMARY KEY,
    genre_name VARCHAR(50) NOT NULL,

    CONSTRAINT uq_genre_name UNIQUE (genre_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CAST` (
    cast_id   INT AUTO_INCREMENT PRIMARY KEY,
    cast_name VARCHAR(150) NOT NULL,

    CONSTRAINT uq_cast_name UNIQUE (cast_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TICKET_TYPE (
    type_id         INT AUTO_INCREMENT PRIMARY KEY,
    type            VARCHAR(50) NOT NULL,
    ticket_discount DECIMAL(5,2) NOT NULL DEFAULT 0.00,  -- percent, e.g. 20.00

    CONSTRAINT uq_ticket_type UNIQUE (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SNACK (
    snack_id    INT AUTO_INCREMENT PRIMARY KEY,
    snack_name  VARCHAR(100) NOT NULL,
    snack_price DECIMAL(10,2) NOT NULL,

    CONSTRAINT uq_snack_name UNIQUE (snack_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. USERS
-- Admins belong to one branch; customers have branch_id = NULL.
-- =====================================================================

CREATE TABLE `USER` (
    user_id           INT AUTO_INCREMENT PRIMARY KEY,
    branch_id         INT NULL,
    role              VARCHAR(50)  NOT NULL,              -- 'admin' | 'customer'
    email             VARCHAR(150) NOT NULL,
    username          VARCHAR(100) NOT NULL,
    password          VARCHAR(255) NOT NULL,              -- bcrypt hash
    name              VARCHAR(150) NOT NULL,              -- "First Last" (combined copy)
    first_name        VARCHAR(75)  NULL,
    last_name         VARCHAR(75)  NULL,
    phone_num         VARCHAR(20)  NULL,
    profile_photo_url VARCHAR(500) NULL,                  -- Cloudinary URL
    google_id         VARCHAR(64)  NULL,                  -- Google account id (Sign in with Google)

    CONSTRAINT uq_user_email    UNIQUE (email),
    CONSTRAINT uq_user_username UNIQUE (username),
    CONSTRAINT uq_user_google_id UNIQUE (google_id),
    CONSTRAINT fk_user_branch
        FOREIGN KEY (branch_id) REFERENCES BRANCH (branch_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4. MOVIES & SCREENINGS (soft delete via deleted_at)
-- =====================================================================

CREATE TABLE MOVIE (
    movie_id     INT AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    synopsis     TEXT NULL,
    duration     INT NOT NULL,                            -- minutes
    age_rating   VARCHAR(20)  NULL,
    language     VARCHAR(50)  NULL,
    base_price   DECIMAL(10,2) NOT NULL,
    poster       VARCHAR(500) NULL,                       -- Cloudinary / external URL
    director     VARCHAR(150) NULL,
    release_date DATE NULL,
    status       VARCHAR(30)  NOT NULL,                   -- 'upcoming' | 'now-showing' | 'ended'
    trailer_url  VARCHAR(255) NULL,
    created_by_branch_id INT NULL,                        -- branch that added it; only that branch can edit/delete
    deleted_at   DATETIME NULL DEFAULT NULL,

    INDEX idx_movie_status (status),
    INDEX idx_movie_deleted_at (deleted_at),
    CONSTRAINT fk_movie_created_by_branch
        FOREIGN KEY (created_by_branch_id) REFERENCES BRANCH (branch_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE MOVIE_GENRE (
    movie_id INT NOT NULL,
    genre_id INT NOT NULL,

    PRIMARY KEY (movie_id, genre_id),
    CONSTRAINT fk_movie_genre_movie
        FOREIGN KEY (movie_id) REFERENCES MOVIE (movie_id) ON DELETE CASCADE,
    CONSTRAINT fk_movie_genre_genre
        FOREIGN KEY (genre_id) REFERENCES GENRE (genre_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE MOVIE_CAST (
    movie_id INT NOT NULL,
    cast_id  INT NOT NULL,

    PRIMARY KEY (movie_id, cast_id),
    CONSTRAINT fk_movie_cast_movie
        FOREIGN KEY (movie_id) REFERENCES MOVIE (movie_id) ON DELETE CASCADE,
    CONSTRAINT fk_movie_cast_cast
        FOREIGN KEY (cast_id) REFERENCES `CAST` (cast_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SCREENING (
    screening_id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id     INT NOT NULL,
    cinema_id    INT NOT NULL,
    show_date    DATE NOT NULL,
    show_time    TIME NOT NULL,
    total_seats  INT NOT NULL,
    booked_seats INT NOT NULL DEFAULT 0,
    status       VARCHAR(50) NOT NULL,                    -- e.g. 'scheduled'
    deleted_at   DATETIME NULL DEFAULT NULL,

    INDEX idx_screening_movie_datetime (movie_id, show_date, show_time),
    INDEX idx_screening_cinema_datetime (cinema_id, show_date, show_time),
    INDEX idx_screening_deleted_at (deleted_at),

    -- RESTRICT (not CASCADE): movies/screenings are soft-deleted, history must survive.
    CONSTRAINT fk_screening_movie
        FOREIGN KEY (movie_id) REFERENCES MOVIE (movie_id) ON DELETE RESTRICT,
    CONSTRAINT fk_screening_cinema
        FOREIGN KEY (cinema_id) REFERENCES CINEMA (cinema_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5. BOOKING
-- =====================================================================

CREATE TABLE TOTAL_PURCHASE (
    purchase_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id            INT NOT NULL,
    payment_method     VARCHAR(50)  NOT NULL,
    total_price        DECIMAL(10,2) NOT NULL,
    purchase_datetime  DATETIME NOT NULL,
    status             VARCHAR(50)  NOT NULL,             -- e.g. 'confirmed', 'cancelled'
    payment_status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
    discount_type      VARCHAR(20)  NOT NULL DEFAULT 'none',
    id_image_url       VARCHAR(255) NULL,                 -- LEGACY: superseded by BOOKING_ID_IMAGE
    reference_code     VARCHAR(100) NULL,
    verification_token CHAR(32)     NULL,                 -- QR ticket: /verify/<token>
    contact_email      VARCHAR(255) NULL,                 -- checkout email (recipient of ticket emails)
    payment_ref        VARCHAR(100) NULL,                 -- Xendit invoice id (PAYMENT_PROVIDER=xendit)

    CONSTRAINT uq_purchase_reference UNIQUE (reference_code),
    CONSTRAINT uq_total_purchase_verification_token UNIQUE (verification_token),
    CONSTRAINT uq_total_purchase_payment_ref UNIQUE (payment_ref),  -- one paid invoice confirms one booking
    INDEX idx_purchase_user (user_id),
    INDEX idx_purchase_status (status),
    CONSTRAINT fk_total_purchase_user
        FOREIGN KEY (user_id) REFERENCES `USER` (user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SEATBOOKING (
    seat_id      INT NOT NULL,
    screening_id INT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'available',
    held_until   DATETIME NULL,
    held_by      INT NULL,

    PRIMARY KEY (seat_id, screening_id),
    INDEX idx_seatbooking_screening_status (screening_id, status),
    CONSTRAINT fk_seatbooking_seat
        FOREIGN KEY (seat_id) REFERENCES SEAT (seat_id) ON DELETE CASCADE,
    CONSTRAINT fk_seatbooking_screening
        FOREIGN KEY (screening_id) REFERENCES SCREENING (screening_id) ON DELETE CASCADE,
    CONSTRAINT fk_seatbooking_user
        FOREIGN KEY (held_by) REFERENCES `USER` (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TICKET (
    ticket_id    INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id  INT NOT NULL,
    screening_id INT NOT NULL,
    seat_id      INT NOT NULL,
    type_id      INT NOT NULL,
    ticket_price DECIMAL(10,2) NOT NULL,
    booking_ref  VARCHAR(100) NOT NULL,
    promo_code   VARCHAR(30) NULL,

    CONSTRAINT uq_ticket_screening_seat UNIQUE (screening_id, seat_id),
    INDEX idx_ticket_purchase (purchase_id),
    INDEX idx_ticket_booking_ref (booking_ref),
    CONSTRAINT fk_ticket_purchase
        FOREIGN KEY (purchase_id) REFERENCES TOTAL_PURCHASE (purchase_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_screening
        FOREIGN KEY (screening_id) REFERENCES SCREENING (screening_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_seat
        FOREIGN KEY (seat_id) REFERENCES SEAT (seat_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_type
        FOREIGN KEY (type_id) REFERENCES TICKET_TYPE (type_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SNACK_PURCHASE (
    purchase_id INT NOT NULL,
    snack_id    INT NOT NULL,
    quantity    INT NOT NULL,
    subtotal    DECIMAL(10,2) NOT NULL,

    PRIMARY KEY (purchase_id, snack_id),
    CONSTRAINT fk_snack_purchase_purchase
        FOREIGN KEY (purchase_id) REFERENCES TOTAL_PURCHASE (purchase_id) ON DELETE RESTRICT,
    CONSTRAINT fk_snack_purchase_snack
        FOREIGN KEY (snack_id) REFERENCES SNACK (snack_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One private Senior/PWD ID photo per discounted seat of a booking.
CREATE TABLE BOOKING_ID_IMAGE (
    id_image_id  INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id  INT NOT NULL,
    seat_id      INT NOT NULL,
    id_image_url VARCHAR(255) NOT NULL,  -- "cloudinary:<public_id>" or "private/id-uploads/<file>"
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_booking_id_image UNIQUE (purchase_id, seat_id),
    CONSTRAINT fk_booking_id_image_purchase
        FOREIGN KEY (purchase_id) REFERENCES TOTAL_PURCHASE (purchase_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_id_image_seat
        FOREIGN KEY (seat_id) REFERENCES SEAT (seat_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6. EMAIL OTP (sign-up verification and password reset)
-- One active code per email and purpose. Only an HMAC of the code is stored.
-- =====================================================================

CREATE TABLE EMAIL_OTP (
    otp_id     INT AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(150) NOT NULL,               -- lowercase
    purpose    VARCHAR(20)  NOT NULL DEFAULT 'signup',  -- 'signup' | 'reset'
    otp_hash   CHAR(64)     NOT NULL,               -- HMAC-SHA256 hex
    expires_at DATETIME     NOT NULL,
    attempts   INT          NOT NULL DEFAULT 0,     -- wrong guesses; locked at 5
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- resend cooldown

    CONSTRAINT uq_email_otp_email_purpose UNIQUE (email, purpose),
    INDEX idx_email_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;