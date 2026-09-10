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

INSERT INTO MOVIE
(title, synopsis, duration, age_rating, language, base_price, poster, director, release_date)
VALUES

(
'Spider-Man: Brand New Day',
'Peter Parker continues his journey as Spider-Man while facing new challenges and enemies.',
135,
'PG-13',
'English',
350.00,
'/images/spider-man-brand-new-day.jpg',
'Destin Daniel Cretton',
'2026-07-31'
),

(
'Insidious: Out of the Further',
'A supernatural horror story exploring terrifying events connected to the mysterious world beyond.',
120,
'R',
'English',
350.00,
'/images/insidious-out-of-the-further.jpg',
'Jeremy Slater',
'2026-08-19'
),

(
'Onslaught',
'A high-intensity action thriller involving survival, conflict, and unexpected threats.',
110,
'R',
'English',
350.00,
'/images/onslaught.jpg',
'Adam Egypt Mortimer',
'2026-09-01'
),

(
'The Odyssey',
'An epic adventure following a hero through a dangerous journey filled with mythology and discovery.',
180,
'PG-13',
'English',
400.00,
'/images/the-odyssey.jpg',
'Christopher Nolan',
'2026-07-17'
),

(
'Practical Magic 2',
'A magical story about family, love, and supernatural challenges.',
120,
'PG-13',
'English',
350.00,
'/images/practical-magic-2.jpg',
'Susanne Bier',
'2026-09-18'
),

(
'Resident Evil',
'A survival horror story following characters battling dangerous threats and mysteries.',
110,
'R',
'English',
350.00,
'/images/resident-evil.jpg',
'Zach Cregger',
'2026-09-18'
),

(
'Forgotten Island',
'A group of explorers discover secrets on a mysterious island while fighting to survive.',
105,
'PG-13',
'English',
300.00,
'/images/forgotten-island.jpg',
'Andy Muschietti',
'2026-10-09'
),

(
'Saving Cherry',
'A Filipino drama about friendship, family, and overcoming personal struggles.',
120,
'PG',
'Filipino',
300.00,
'/images/saving-cherry.jpg',
'Mae Cruz-Alviar',
'2026-08-27'
),

(
'Life After You',
'A Filipino story about healing, acceptance, and finding new beginnings after loss.',
115,
'PG-13',
'Filipino',
300.00,
'/images/life-after-you.jpg',
'Dan Villegas',
'2026-09-10'
),

(
'EDJOP',
'A Filipino historical drama inspired by the life and struggles of a young activist.',
110,
'PG-13',
'Filipino',
300.00,
'/images/edjop.jpg',
'Jun Robles Lana',
'2026-09-30'
);

INSERT INTO MOVIE_GENRE
(movie_id, genre_id)
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

INSERT INTO MOVIE_CAST
(movie_id, cast_id)
VALUES

-- Spider-Man: Brand New Day
(1,1),
(1,2),
(1,3),
(1,4),

-- Insidious: Out of the Further
(2,5),
(2,6),
(2,7),
(2,8),

-- Onslaught
(3,9),
(3,10),
(3,11),

-- The Odyssey
(4,12),
(4,13),
(4,14),
(4,1),

-- Practical Magic 2
(5,15),
(5,16),
(5,17),
(5,18),

-- Resident Evil
(6,19),
(6,20),
(6,21),

-- Forgotten Island
(7,22),
(7,23),
(7,24),

-- Saving Cherry
(8,25),
(8,26),
(8,27),

-- Life After You
(9,28),
(9,29),
(9,30),

-- EDJOP
(10,31),
(10,32),
(10,33);

INSERT INTO BRANCH
(branch_id, branch_name)
VALUES

(1, 'Vista Mall Taguig'),
(2, 'Market! Market!'),
(3, 'Venice McKinley');

INSERT INTO 
CINEMA (cinema_id,  branch_id, cinema_num) 
VALUES

(1, 1, 1),
(2, 1, 2),
(3, 1, 3),
(4, 2, 1),
(5, 2, 2),
(6, 2, 3),
(7, 3, 1),
(8, 3, 2),
(9, 3, 3);

INSERT INTO User
(branch_id, role, email, username, name, phone_num)
VALUES
(1, 'admin', 'admin@filmvault.com', 'admin', 'FilmVault Admin', '09171234567'),
(1, 'customer', 'ariana@gmail.com', 'ariana123', 'Ariana Grande', '09181234567'),
(2, 'customer', 'maria@gmail.com', 'maria123', 'Maria Cruz', '09191234567'),
(2, 'customer', 'ana@gmail.com', 'ana123', 'Ana Andrade', '09201234567'),
(3, 'customer', 'mark@gmail.com', 'mark123', 'Mark Garcia', '09211234567');