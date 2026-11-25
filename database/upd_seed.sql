-- =====================================================================
-- Test logins (all passwords meet the rule: 8+ chars, upper, lower, number, symbol)
--   user_id | username      | email                              | password
--   1       | admin         | admin@filmvault.com                | Admin@123   (Vista Mall Taguig admin)
--   2       | admin_mm      | admin.marketmarket@filmvault.com   | Admin@123   (Market! Market! admin)
--   3       | admin_venice  | admin.venice@filmvault.com         | Admin@123   (Venice McKinley admin)
--   4       | tester        | tester@filmvault.com               | Tester@123
--   5       | ariana123     | ariana@gmail.com                   | Ariana@123
--   6       | maria123      | maria@gmail.com                    | Maria@123
--   7       | ana123        | ana@gmail.com                      | Ana@123
--   8       | mark123       | mark@gmail.com                     | Mark@123
-- =====================================================================

USE filmvault;

-- =====================================================================
-- BRANCHES & CINEMAS
-- 3 cinemas per branch (Cinema 1-3)
-- =====================================================================

INSERT INTO BRANCH (branch_id, branch_name) VALUES
(1, 'Vista Mall Taguig'),
(2, 'Market! Market!'),
(3, 'Venice McKinley');

INSERT INTO CINEMA (cinema_id, branch_id, cinema_num) VALUES
(1, 1, 1), (2, 1, 2), (3, 1, 3),
(4, 2, 1), (5, 2, 2), (6, 2, 3),
(7, 3, 1), (8, 3, 2), (9, 3, 3);

-- =====================================================================
-- SEATS (generated from branch capacity, 10 seats per row)
--   Vista Mall       6 rows x 10 =  60 seats per cinema
--   Market! Market! 10 rows x 10 = 100 seats per cinema
--   Venice           8 rows x 10 =  80 seats per cinema
-- =====================================================================

INSERT INTO SEAT (cinema_id, row_num, seat_num, seat_status)
WITH RECURSIVE n AS (
    SELECT 1 AS i
    UNION ALL
    SELECT i + 1 FROM n WHERE i < 10
)
SELECT c.cinema_id, r.i, s.i, 'active'
FROM CINEMA c
JOIN n r ON r.i <= CASE c.branch_id WHEN 1 THEN 6 WHEN 2 THEN 10 ELSE 8 END
JOIN n s ON s.i <= 10
ORDER BY c.cinema_id, r.i, s.i;

-- =====================================================================
-- LOOKUPS
-- =====================================================================

INSERT INTO GENRE (genre_id, genre_name) VALUES
(1, 'Action'), (2, 'Adventure'), (3, 'Animation'), (4, 'Comedy'), (5, 'Drama'),
(6, 'Fantasy'), (7, 'Horror'), (8, 'Romance'), (9, 'Science Fiction'), (10, 'Thriller');

INSERT INTO TICKET_TYPE (type_id, type, ticket_discount) VALUES
(1, 'Regular', 0.00),
(2, 'Senior', 20.00),
(3, 'PWD', 20.00);

INSERT INTO SNACK (snack_id, snack_name, snack_price) VALUES
(1, 'Popcorn', 120.00),
(2, 'Soda', 60.00),
(3, 'Nachos', 100.00);

-- =====================================================================
-- USERS (admins are per branch; customers have no branch)
-- =====================================================================

INSERT INTO `USER` (user_id, branch_id, role, email, username, password, name, first_name, last_name, phone_num) VALUES
(1, 1,    'admin',    'admin@filmvault.com',                'admin',        '$2b$10$k8lWv0KlCzfv1a.AxVQLe.ot9ihn9F9k2iiu.HQNWyzC7NI2qxcaK', 'FilmVault Admin', 'FilmVault', 'Admin',            '09171234567'),
(2, 2,    'admin',    'admin.marketmarket@filmvault.com',   'admin_mm',     '$2b$10$k8lWv0KlCzfv1a.AxVQLe.ot9ihn9F9k2iiu.HQNWyzC7NI2qxcaK', 'Market! Market! Admin', 'Market! Market!', 'Admin',      '09171234568'),
(3, 3,    'admin',    'admin.venice@filmvault.com',         'admin_venice', '$2b$10$k8lWv0KlCzfv1a.AxVQLe.ot9ihn9F9k2iiu.HQNWyzC7NI2qxcaK', 'Venice McKinley Admin', 'Venice McKinley', 'Admin',     '09171234569'),
(4, NULL, 'customer', 'tester@filmvault.com',               'tester',       '$2b$10$QmuAHjEH.tJUJqrDaak.W.ozMoJjYREk4ZVsS3LvJZR0pO/t1MQjy', 'Test Customer', 'Test', 'Customer',           '09170000000'),
(5, NULL, 'customer', 'ariana@gmail.com',                   'ariana123',    '$2b$10$.y8sQu3yegxOqKIog6DFd.N5wXdPlObrOJ36A39dHh2ux/EVdH5fe', 'Ariana Grande', 'Ariana', 'Grande',           '09181234567'),
(6, NULL, 'customer', 'maria@gmail.com',                    'maria123',     '$2b$10$N1Iy.gy/urAo/1y7OQ9T2OjRg24mxQQUP3CkXwFKxcafqkEfvlD4K', 'Maria Cruz', 'Maria', 'Cruz',              '09191234567'),
(7, NULL, 'customer', 'ana@gmail.com',                      'ana123',       '$2b$10$2wnffwmTpOdgdPEDZfGIWuYD/U4gxpcVd1lY8gnwSJCO.LLe0s/eW', 'Ana Andrade', 'Ana', 'Andrade',              '09201234567'),
(8, NULL, 'customer', 'mark@gmail.com',                     'mark123',      '$2b$10$kJ0EF3XPkKeYP39Vs5CNneb7ex5tBIqLiq.H9XXPYpM./UYX.6J7W', 'Mark Garcia', 'Mark', 'Garcia',              '09211234567');

-- =====================================================================
-- MOVIES
-- =====================================================================

INSERT INTO MOVIE
(movie_id, title, synopsis, duration, age_rating, language, base_price, poster, director, release_date, status, trailer_url)
VALUES
(1, 'Spider-Man: Brand New Day',
 'Peter Parker continues his journey as Spider-Man while facing new challenges and enemies.',
 135, 'PG-13', 'English', 350.00,
 'https://image.tmdb.org/t/p/w500/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg',
 'Destin Daniel Cretton', '2026-12-31', 'upcoming',
 'https://www.youtube.com/watch?v=8TZMtslA3UY'),

(2, 'Insidious: Out of the Further',
 'A supernatural horror story exploring terrifying events connected to the mysterious world beyond.',
 120, 'R', 'English', 350.00,
 'https://image.tmdb.org/t/p/w500/4tTrW9dXCByS5wt2pXVWb58zNjz.jpg',
 'Jeremy Slater', '2026-12-04', 'now-showing',
 'https://www.youtube.com/watch?v=jxU8FU3o75A'),

(3, 'Onslaught',
 'A high-intensity action thriller involving survival, conflict, and unexpected threats.',
 110, 'R', 'English', 350.00,
 'https://image.tmdb.org/t/p/w500/cOGtvhc6Ij9KvzM6jZsfQyg0B0O.jpg',
 'Adam Egypt Mortimer', '2027-01-08', 'upcoming',
 'https://www.youtube.com/watch?v=L24CYVpQ-LI'),

(4, 'The Odyssey',
 'An epic adventure following a hero through a dangerous journey filled with mythology and discovery.',
 180, 'PG-13', 'English', 400.00,
 'https://image.tmdb.org/t/p/w500/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg',
 'Christopher Nolan', '2027-01-15', 'upcoming',
 'https://www.youtube.com/watch?v=LgOMT7ka6do'),

(5, 'Practical Magic 2',
 'A magical story about family, love, and supernatural challenges.',
 120, 'PG-13', 'English', 350.00,
 'https://image.tmdb.org/t/p/w500/ogwQOLbCfncjvBhFb5l0OmQH8KC.jpg',
 'Susanne Bier', '2027-01-22', 'upcoming',
 'https://www.youtube.com/watch?v=Ho10_4IX1jE'),

(6, 'Resident Evil',
 'A survival horror story following characters battling dangerous threats and mysteries.',
 110, 'R', 'English', 350.00,
 'https://image.tmdb.org/t/p/w500/i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg',
 'Zach Cregger', '2026-12-11', 'now-showing',
 'https://www.youtube.com/watch?v=mNd1gb19A-c'),

(7, 'Forgotten Island',
 'A group of explorers discover secrets on a mysterious island while fighting to survive.',
 105, 'PG-13', 'English', 300.00,
 'https://image.tmdb.org/t/p/w500/Lr0Ng7Gg02RW1AyfYEL6P0WUvd.jpg',
 'Andy Muschietti', '2026-10-30', 'ended',
 'https://www.youtube.com/watch?v=f7mFVeWnVLw'),

(8, 'Saving Cherry',
 'A Filipino drama about friendship, family, and overcoming personal struggles.',
 120, 'PG', 'Filipino', 300.00,
 'https://image.tmdb.org/t/p/w500/sm47SAyj8oswBxqnO52fTg7j2nP.jpg',
 'Mae Cruz-Alviar', '2026-12-18', 'now-showing',
 'https://www.youtube.com/watch?v=ABMAJv8--uY'),

(9, 'Life After You',
 'A Filipino story about healing, acceptance, and finding new beginnings after loss.',
 115, 'PG-13', 'Filipino', 300.00,
 'https://image.tmdb.org/t/p/w500/9fqCmsSFdQEdB8CmQgcJrYiq3Cp.jpg',
 'Dan Villegas', '2026-12-18', 'now-showing',
 'https://www.youtube.com/watch?v=YUgBpkrBb8g'),

(10, 'EDJOP',
 'A Filipino historical drama inspired by the life and struggles of a young activist.',
 110, 'PG-13', 'Filipino', 300.00,
 'https://image.tmdb.org/t/p/w500/uzv6R4NtD10XdSfSuqrQlTbq6kT.jpg',
 'Jun Robles Lana', '2026-11-06', 'ended',
 'https://www.youtube.com/watch?v=ANwFKwfl9Tg');

-- Seeded movies belong to Vista Mall Taguig (branch 1); only it can edit/delete them.
UPDATE MOVIE SET created_by_branch_id = 1 WHERE movie_id > 0;

-- =====================================================================
-- CAST
-- =====================================================================

INSERT INTO `CAST` (cast_id, cast_name) VALUES
-- Spider-Man: Brand New Day
(1, 'Tom Holland'), (2, 'Zendaya'), (3, 'Sadie Sink'), (4, 'Jacob Batalon'),
-- Insidious: Out of the Further
(5, 'Lin Shaye'), (6, 'Amelia Eve'), (7, 'Brandon Perea'), (8, 'Maisie Richardson-Sellers'),
-- Onslaught
(9, 'Adria Arjona'), (10, 'Dan Stevens'), (11, 'Rebecca Hall'),
-- The Odyssey
(12, 'Matt Damon'), (13, 'Anne Hathaway'), (14, 'Robert Pattinson'),
-- Practical Magic 2
(15, 'Sandra Bullock'), (16, 'Nicole Kidman'), (17, 'Joey King'), (18, 'Maisie Williams'),
-- Resident Evil
(19, 'Austin Abrams'), (20, 'Paul Walter Hauser'), (21, 'Kali Reis'),
-- Forgotten Island
(22, 'H.E.R.'), (23, 'Liza Soberano'), (24, 'Dave Franco'),
-- Saving Cherry
(25, 'Barbie Forteza'), (26, 'Mika Salamanca'), (27, 'AC Bonifacio'),
-- Life After You
(28, 'Maricel Soriano'), (29, 'Bela Padilla'), (30, 'Dani Zee'),
-- EDJOP
(31, 'Elijah Canlas'), (32, 'Jodi Sta. Maria'), (33, 'Cedrick Juan');

INSERT INTO MOVIE_GENRE (movie_id, genre_id) VALUES
(1, 1), (1, 2), (1, 9),     -- Spider-Man
(2, 7), (2, 10),            -- Insidious
(3, 1), (3, 10),            -- Onslaught
(4, 2), (4, 5), (4, 6),     -- The Odyssey
(5, 6), (5, 8),             -- Practical Magic 2
(6, 1), (6, 7), (6, 10),    -- Resident Evil
(7, 2), (7, 10),            -- Forgotten Island
(8, 5), (8, 8),             -- Saving Cherry
(9, 5), (9, 8),             -- Life After You
(10, 5);                    -- EDJOP

INSERT INTO MOVIE_CAST (movie_id, cast_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),
(2, 5), (2, 6), (2, 7), (2, 8),
(3, 9), (3, 10), (3, 11),
(4, 12), (4, 13), (4, 14), (4, 1),
(5, 15), (5, 16), (5, 17), (5, 18),
(6, 19), (6, 20), (6, 21),
(7, 22), (7, 23), (7, 24),
(8, 25), (8, 26), (8, 27),
(9, 28), (9, 29), (9, 30),
(10, 31), (10, 32), (10, 33);

-- =====================================================================
-- SCREENINGS (every branch has showtimes for testing checkout)
-- =====================================================================

INSERT INTO SCREENING
(screening_id, movie_id, cinema_id, show_date, show_time, total_seats, booked_seats, status)
VALUES
(1, 2, 1, '2026-12-25', '10:00:00', 60, 0, 'scheduled'),  -- Insidious: Out of the Further
(2, 6, 1, '2026-12-25', '13:00:00', 60, 0, 'scheduled'),  -- Resident Evil
(3, 8, 1, '2026-12-30', '16:00:00', 60, 0, 'scheduled'),  -- Saving Cherry
(4, 9, 1, '2026-12-30', '19:00:00', 60, 0, 'scheduled'),  -- Life After You

-- Market! Market! (cinemas 4-6, 100 seats each)
(5,  2, 4, '2026-12-25', '11:00:00', 100, 0, 'scheduled'),  -- Insidious: Out of the Further
(6,  6, 4, '2026-12-25', '14:00:00', 100, 0, 'scheduled'),  -- Resident Evil
(7,  8, 5, '2026-12-26', '13:00:00', 100, 0, 'scheduled'),  -- Saving Cherry
(8,  9, 5, '2026-12-26', '16:00:00', 100, 0, 'scheduled'),  -- Life After You
(9,  2, 6, '2026-12-27', '19:00:00', 100, 0, 'scheduled'),  -- Insidious: Out of the Further
(10, 6, 6, '2026-12-27', '21:00:00', 100, 0, 'scheduled'),  -- Resident Evil

-- Venice McKinley (cinemas 7-9, 80 seats each)
(11, 2, 7, '2026-12-25', '12:00:00', 80, 0, 'scheduled'),  -- Insidious: Out of the Further
(12, 6, 7, '2026-12-25', '15:00:00', 80, 0, 'scheduled'),  -- Resident Evil
(13, 8, 8, '2026-12-26', '14:00:00', 80, 0, 'scheduled'),  -- Saving Cherry
(14, 9, 8, '2026-12-26', '17:00:00', 80, 0, 'scheduled'),  -- Life After You
(15, 6, 9, '2026-12-28', '20:00:00', 80, 0, 'scheduled'),  -- Resident Evil
(16, 9, 9, '2026-12-28', '18:00:00', 80, 0, 'scheduled');  -- Life After You

-- Every seat of the cinema starts 'available' for each seeded screening
INSERT INTO SEATBOOKING (seat_id, screening_id, status)
SELECT st.seat_id, sc.screening_id, 'available'
FROM SCREENING sc
JOIN SEAT st ON st.cinema_id = sc.cinema_id;

-- =====================================================================
-- Quick checks (should return 720 seats, 1320 seat bookings)
-- =====================================================================
SELECT COUNT(*) AS seats FROM SEAT;
SELECT COUNT(*) AS seatbookings FROM SEATBOOKING;