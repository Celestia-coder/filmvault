-- DEVELOPMENT ONLY: removes all FilmVault tables and their data in the
-- currently selected database. Select the intended database before running.
-- Rebuild by running schema.sql followed by seed.sql after this script.
-- DDL is not transactional. Child tables are dropped before their parents,
-- so foreign key checks stay enabled. No database is dropped or created.

DROP TABLE IF EXISTS TICKET;
DROP TABLE IF EXISTS SNACK_PURCHASE;
DROP TABLE IF EXISTS SEATBOOKING;
DROP TABLE IF EXISTS MOVIE_CAST;
DROP TABLE IF EXISTS MOVIE_GENRE;
DROP TABLE IF EXISTS TOTAL_PURCHASE;
DROP TABLE IF EXISTS SCREENING;
DROP TABLE IF EXISTS `USER`;
DROP TABLE IF EXISTS SEAT;
DROP TABLE IF EXISTS CINEMA;
DROP TABLE IF EXISTS TICKET_TYPE;
DROP TABLE IF EXISTS SNACK;
DROP TABLE IF EXISTS `CAST`;
DROP TABLE IF EXISTS GENRE;
DROP TABLE IF EXISTS MOVIE;
DROP TABLE IF EXISTS BRANCH;
