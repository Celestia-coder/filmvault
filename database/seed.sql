-- Run once after schema.sql in an empty development database.
-- Existing ID references depend on fresh AUTO_INCREMENT sequences.
-- Use the same timestamp for screening dates, purchase times, and seat holds.

SET @seed_now = NOW();

START TRANSACTION;

INSERT INTO GENRE (genre_name)
VALUES
    ('Action'),
    ('Adventure'),
    ('Animation'),
    ('Comedy'),
    ('Drama'),
    ('Fantasy'),
    ('Horror'),
    ('Romance'),
    ('Science Fiction'),
    ('Thriller');

INSERT INTO `CAST` (cast_name)
VALUES
    -- Spider-Man: Brand New Day
    ('Tom Holland'),
    ('Zendaya'),
    ('Sadie Sink'),
    ('Jacob Batalon'),

    -- Insidious: Out of the Further
    ('Lin Shaye'),
    ('Amelia Eve'),
    ('Brandon Perea'),
    ('Maisie Richardson-Sellers'),

    -- Onslaught
    ('Adria Arjona'),
    ('Dan Stevens'),
    ('Rebecca Hall'),

    -- The Odyssey
    ('Matt Damon'),
    ('Anne Hathaway'),
    ('Robert Pattinson'),

    -- Practical Magic 2
    ('Sandra Bullock'),
    ('Nicole Kidman'),
    ('Joey King'),
    ('Maisie Williams'),

    -- Resident Evil
    ('Austin Abrams'),
    ('Paul Walter Hauser'),
    ('Kali Reis'),

    -- Forgotten Island
    ('H.E.R.'),
    ('Liza Soberano'),
    ('Dave Franco'),

    -- Saving Cherry
    ('Barbie Forteza'),
    ('Mika Salamanca'),
    ('AC Bonifacio'),

    -- Life After You
    ('Maricel Soriano'),
    ('Bela Padilla'),
    ('Dani Zee'),

    -- EDJOP
    ('Elijah Canlas'),
    ('Jodi Sta. Maria'),
    ('Cedrick Juan');

INSERT INTO MOVIE (
    title,
    synopsis,
    duration,
    age_rating,
    language,
    base_price,
    poster,
    director,
    release_date,
    status,
    trailer_url
)
VALUES
    (
        'Spider-Man: Brand New Day',
        'Peter Parker continues his journey as Spider-Man while facing new challenges and enemies.',
        135,
        'PG-13',
        'English',
        350.00,
        'https://image.tmdb.org/t/p/w500/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg',
        'Destin Daniel Cretton',
        '2026-07-31',
        'upcoming',
        'https://www.youtube.com/watch?v=8TZMtslA3UY'
    ),
    (
        'Insidious: Out of the Further',
        'A supernatural horror story exploring terrifying events connected to the mysterious world beyond.',
        120,
        'R',
        'English',
        350.00,
        'https://image.tmdb.org/t/p/w500/4tTrW9dXCByS5wt2pXVWb58zNjz.jpg',
        'Jeremy Slater',
        '2026-08-19',
        'now-showing',
        'https://www.youtube.com/watch?v=jxU8FU3o75A'
    ),
    (
        'Onslaught',
        'A high-intensity action thriller involving survival, conflict, and unexpected threats.',
        110,
        'R',
        'English',
        350.00,
        'https://image.tmdb.org/t/p/w500/cOGtvhc6Ij9KvzM6jZsfQyg0B0O.jpg',
        'Adam Egypt Mortimer',
        '2026-09-01',
        'upcoming',
        'https://www.youtube.com/watch?v=L24CYVpQ-LI'
    ),
    (
        'The Odyssey',
        'An epic adventure following a hero through a dangerous journey filled with mythology and discovery.',
        180,
        'PG-13',
        'English',
        400.00,
        'https://image.tmdb.org/t/p/w500/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg',
        'Christopher Nolan',
        '2026-07-17',
        'upcoming',
        'https://www.youtube.com/watch?v=LgOMT7ka6do'
    ),
    (
        'Practical Magic 2',
        'A magical story about family, love, and supernatural challenges.',
        120,
        'PG-13',
        'English',
        350.00,
        'https://image.tmdb.org/t/p/w500/ogwQOLbCfncjvBhFb5l0OmQH8KC.jpg',
        'Susanne Bier',
        '2026-09-18',
        'upcoming',
        'https://www.youtube.com/watch?v=Ho10_4IX1jE'
    ),
    (
        'Resident Evil',
        'A survival horror story following characters battling dangerous threats and mysteries.',
        110,
        'R',
        'English',
        350.00,
        'https://image.tmdb.org/t/p/w500/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg',
        'Zach Cregger',
        '2026-09-18',
        'now-showing',
        'https://www.youtube.com/watch?v=mNd1gb19A-c'
    ),
    (
        'Forgotten Island',
        'A group of explorers discover secrets on a mysterious island while fighting to survive.',
        105,
        'PG-13',
        'English',
        300.00,
        'https://image.tmdb.org/t/p/w500/Lr0Ng7Gg02RW1AyfYEL6P0WUvd.jpg',
        'Andy Muschietti',
        '2026-10-09',
        'ended',
        'https://www.youtube.com/watch?v=f7mFVeWnVLw'
    ),
    (
        'Saving Cherry',
        'A Filipino drama about friendship, family, and overcoming personal struggles.',
        120,
        'PG',
        'Filipino',
        300.00,
        'https://image.tmdb.org/t/p/w500/sm47SAyj8oswBxqnO52fTg7j2nP.jpg',
        'Mae Cruz-Alviar',
        '2026-08-27',
        'now-showing',
        'https://www.youtube.com/watch?v=ABMAJv8--uY'
    ),
    (
        'Life After You',
        'A Filipino story about healing, acceptance, and finding new beginnings after loss.',
        115,
        'PG-13',
        'Filipino',
        300.00,
        'https://image.tmdb.org/t/p/w500/9fqCmsSFdQEdB8CmQgcJrYiq3Cp.jpg',
        'Dan Villegas',
        '2026-09-10',
        'now-showing',
        'https://www.youtube.com/watch?v=YUgBpkrBb8g'
    ),
    (
        'EDJOP',
        'A Filipino historical drama inspired by the life and struggles of a young activist.',
        110,
        'PG-13',
        'Filipino',
        300.00,
        'https://image.tmdb.org/t/p/w500/uzv6R4NtD10XdSfSuqrQlTbq6kT.jpg',
        'Jun Robles Lana',
        '2026-09-30',
        'ended',
        'https://www.youtube.com/watch?v=ANwFKwfl9Tg'
    );

INSERT INTO MOVIE_GENRE (movie_id, genre_id)
VALUES
    -- Spider-Man: Brand New Day
    (1, 1),
    (1, 2),
    (1, 9),

    -- Insidious: Out of the Further
    (2, 7),
    (2, 10),

    -- Onslaught
    (3, 1),
    (3, 10),

    -- The Odyssey
    (4, 2),
    (4, 5),
    (4, 6),

    -- Practical Magic 2
    (5, 6),
    (5, 8),

    -- Resident Evil
    (6, 1),
    (6, 7),
    (6, 10),

    -- Forgotten Island
    (7, 2),
    (7, 10),

    -- Saving Cherry
    (8, 5),
    (8, 8),

    -- Life After You
    (9, 5),
    (9, 8),

    -- EDJOP
    (10, 5);

INSERT INTO MOVIE_CAST (movie_id, cast_id)
VALUES
    -- Spider-Man: Brand New Day
    (1, 1),
    (1, 2),
    (1, 3),
    (1, 4),

    -- Insidious: Out of the Further
    (2, 5),
    (2, 6),
    (2, 7),
    (2, 8),

    -- Onslaught
    (3, 9),
    (3, 10),
    (3, 11),

    -- The Odyssey
    (4, 12),
    (4, 13),
    (4, 14),
    (4, 1),

    -- Practical Magic 2
    (5, 15),
    (5, 16),
    (5, 17),
    (5, 18),

    -- Resident Evil
    (6, 19),
    (6, 20),
    (6, 21),

    -- Forgotten Island
    (7, 22),
    (7, 23),
    (7, 24),

    -- Saving Cherry
    (8, 25),
    (8, 26),
    (8, 27),

    -- Life After You
    (9, 28),
    (9, 29),
    (9, 30),

    -- EDJOP
    (10, 31),
    (10, 32),
    (10, 33);

INSERT INTO BRANCH (branch_id, branch_name)
VALUES
    (1, 'Vista Mall Taguig'),
    (2, 'Market! Market!'),
    (3, 'Venice McKinley');

INSERT INTO CINEMA (cinema_id, branch_id, cinema_num)
VALUES
    -- Vista Mall Taguig: 3 cinemas
    (1, 1, 1),
    (2, 1, 2),
    (3, 1, 3),

    -- Market! Market!: 7 cinemas
    (4, 2, 1),
    (5, 2, 2),
    (6, 2, 3),
    (10, 2, 4),
    (11, 2, 5),
    (12, 2, 6),
    (13, 2, 7),

    -- Venice McKinley: 4 cinemas
    (7, 3, 1),
    (8, 3, 2),
    (9, 3, 3),
    (14, 3, 4);

INSERT INTO `USER` (
    branch_id,
    role,
    email,
    username,
    password,
    name,
    phone_num
)
VALUES
    (1, 'admin', 'admin@filmvault.com', 'admin', '<hash_password>', 'FilmVault Admin', '09171234567'),
    (1, 'customer', 'ariana@gmail.com', 'ariana123', '<hash_password>', 'Ariana Grande', '09181234567'),
    (2, 'customer', 'maria@gmail.com', 'maria123', '<hash_password>', 'Maria Cruz', '09191234567'),
    (2, 'customer', 'ana@gmail.com', 'ana123', '<hash_password>', 'Ana Andrade', '09201234567'),
    (3, 'customer', 'mark@gmail.com', 'mark123', '<hash_password>', 'Mark Garcia', '09211234567');

-- Provisional seat numbering: sequential seat numbers grouped into rows of 20.
-- IMPORTANT: update row/seat positions once the frontend SeatGrid/aisleAfter layout is defined.
-- Required capacities: Vista 140 x 3, Market! Market! 360 x 7, Venice 282 x 4.
-- This generates the exact seat count per cinema, but does not claim to match final aisle layout.

INSERT INTO SEAT (cinema_id, row_num, seat_num, seat_status)
WITH RECURSIVE seq AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1
    FROM seq
    WHERE n < 360
)
SELECT
    c.cinema_id,
    CEIL(seq.n / 20) AS row_num,
    MOD(seq.n - 1, 20) + 1 AS seat_num,
    'active'
FROM CINEMA AS c
JOIN seq
    ON seq.n <= CASE
        WHEN c.branch_id = 1 THEN 140
        WHEN c.branch_id = 2 THEN 360
        WHEN c.branch_id = 3 THEN 282
    END
ORDER BY c.cinema_id, seq.n;

INSERT INTO SCREENING (
    movie_id,
    cinema_id,
    show_date,
    show_time,
    total_seats,
    booked_seats,
    status
)
VALUES
    -- Insidious: Out of the Further
    (2, 1, DATE(DATE_ADD(@seed_now, INTERVAL 1 DAY)), '10:00:00', 140, 0, 'scheduled'),

    -- Resident Evil
    (6, 1, DATE(DATE_ADD(@seed_now, INTERVAL 1 DAY)), '13:00:00', 140, 0, 'scheduled'),

    -- Saving Cherry
    (8, 1, DATE(DATE_ADD(@seed_now, INTERVAL 1 DAY)), '16:00:00', 140, 0, 'scheduled'),

    -- Life After You
    (9, 1, DATE(DATE_ADD(@seed_now, INTERVAL 1 DAY)), '19:00:00', 140, 0, 'scheduled');

-- Discounts are percentages used by these fixtures, not pricing policy.

INSERT INTO TICKET_TYPE (type_id, type, ticket_discount)
VALUES
    (1, 'Regular', 0.00),
    (2, 'Student', 10.00),
    (3, 'Senior', 20.00);

INSERT INTO SNACK (snack_id, snack_name, snack_price)
VALUES
    (1, 'Popcorn', 120.00),
    (2, 'Soda', 60.00),
    (3, 'Nachos', 100.00);

-- Ariana has two confirmed purchases and a cancellation before ticket issuance.
-- Mark (user 5) has no purchases, providing an empty-history scenario.

INSERT INTO TOTAL_PURCHASE (
    purchase_id,
    user_id,
    payment_method,
    total_price,
    purchase_datetime,
    status,
    reference_code
)
VALUES
    (1, 2, 'card', 905.00, DATE_SUB(@seed_now, INTERVAL 2 DAY), 'confirmed', 'W4-P001'),
    (2, 2, 'gcash', 280.00, DATE_SUB(@seed_now, INTERVAL 1 DAY), 'confirmed', 'W4-P002'),
    (3, 3, 'cash', 670.00, DATE_SUB(@seed_now, INTERVAL 6 HOUR), 'confirmed', 'W4-P003'),
    (4, 4, 'card', 300.00, DATE_SUB(@seed_now, INTERVAL 2 HOUR), 'confirmed', 'W4-P004'),
    (5, 2, 'gcash', 0.00, DATE_SUB(@seed_now, INTERVAL 1 HOUR), 'cancelled', 'W4-P005');

-- Every ticket uses a seat in its screening's cinema.
-- Each reference identifies a ticket; purchase_id groups tickets for checkout.

INSERT INTO TICKET (
    ticket_id,
    purchase_id,
    screening_id,
    seat_id,
    type_id,
    ticket_price,
    booking_ref
)
VALUES
    (1, 1, 1, 1, 1, 350.00, 'W4-P001-T001'),
    (2, 1, 1, 2, 2, 315.00, 'W4-P001-T002'),
    (3, 2, 2, 1, 3, 280.00, 'W4-P002-T003'),
    (4, 3, 3, 1, 1, 300.00, 'W4-P003-T004'),
    (5, 3, 3, 2, 2, 270.00, 'W4-P003-T005'),
    (6, 4, 3, 3, 3, 240.00, 'W4-P004-T006');

INSERT INTO SNACK_PURCHASE (purchase_id, snack_id, quantity, subtotal)
VALUES
    (1, 1, 1, 120.00),
    (1, 2, 2, 120.00),
    (3, 3, 1, 100.00),
    (4, 2, 1, 60.00);

-- One availability row for every seat belonging to each screening's cinema.

INSERT INTO SEATBOOKING (seat_id, screening_id, status, held_until)
SELECT
    s.seat_id,
    sc.screening_id,
    'available',
    NULL
FROM SCREENING AS sc
JOIN SEAT AS s
    ON s.cinema_id = sc.cinema_id;

UPDATE SEATBOOKING AS sb
JOIN TICKET AS t
    ON t.screening_id = sb.screening_id
    AND t.seat_id = sb.seat_id
SET
    sb.status = 'booked',
    sb.held_until = NULL;

-- Active holds block these seats until the hold expires.

UPDATE SEATBOOKING
SET
    status = 'held',
    held_until = DATE_ADD(@seed_now, INTERVAL 30 MINUTE)
WHERE (screening_id, seat_id) IN ((1, 3), (2, 2));

-- Intentionally retain expired holds for availability/cleanup testing.

UPDATE SEATBOOKING
SET
    status = 'held',
    held_until = DATE_SUB(@seed_now, INTERVAL 30 MINUTE)
WHERE (screening_id, seat_id) IN ((1, 4), (2, 3));

-- Holds do not count as booked seats; all seeded tickets are confirmed.

UPDATE SCREENING AS sc
SET booked_seats = (
    SELECT COUNT(*)
    FROM TICKET AS t
    WHERE t.screening_id = sc.screening_id
)
WHERE sc.screening_id IN (1, 2, 3, 4);

COMMIT;

-- Validation: expected seat counts are 140 / 360 / 282 per cinema.

SELECT
    b.branch_name,
    c.cinema_num,
    COUNT(s.seat_id) AS actual_seats
FROM BRANCH AS b
JOIN CINEMA AS c
    ON c.branch_id = b.branch_id
LEFT JOIN SEAT AS s
    ON s.cinema_id = c.cinema_id
GROUP BY
    b.branch_id,
    b.branch_name,
    c.cinema_id,
    c.cinema_num
ORDER BY b.branch_id, c.cinema_num;

-- Expected total: 4,068 seats.

SELECT COUNT(*) AS total_seats
FROM SEAT;

-- Every screening should have one SeatBooking row per seat in its cinema.

SELECT
    sc.screening_id,
    sc.total_seats,
    COUNT(sb.seat_id) AS seatbooking_rows,
    SUM(sb.status = 'booked') AS booked_rows,
    SUM(sb.status = 'held') AS held_rows
FROM SCREENING AS sc
LEFT JOIN SEATBOOKING AS sb
    ON sb.screening_id = sc.screening_id
GROUP BY sc.screening_id, sc.total_seats
ORDER BY sc.screening_id;
