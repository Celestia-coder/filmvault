CREATE TABLE BRANCH (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL
);

CREATE TABLE CINEMA (
    cinema_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    cinema_num INT NOT NULL,

    CONSTRAINT fk_cinema_branch
        FOREIGN KEY (branch_id)
        REFERENCES BRANCH(branch_id)
);

CREATE TABLE SEAT (
    seat_id INT AUTO_INCREMENT PRIMARY KEY,
    cinema_id INT NOT NULL,
    row_num INT NOT NULL,
    seat_num INT NOT NULL,

    CONSTRAINT fk_seat_cinema
        FOREIGN KEY (cinema_id)
        REFERENCES CINEMA(cinema_id),

    CONSTRAINT uq_seat_position
        UNIQUE (cinema_id, row_num, seat_num)
);

CREATE TABLE GENRE (
    genre_id INT AUTO_INCREMENT PRIMARY KEY,
    genre_name VARCHAR(50) NOT NULL
);

CREATE TABLE `CAST` (
    cast_id INT AUTO_INCREMENT PRIMARY KEY,
    cast_name VARCHAR(150) NOT NULL
);

CREATE TABLE TICKET_TYPE (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    ticket_discount DECIMAL(5,2) NOT NULL DEFAULT 0.00
);

CREATE TABLE SNACK (
    snack_id INT AUTO_INCREMENT PRIMARY KEY,
    snack_name VARCHAR(100) NOT NULL,
    snack_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE `USER` (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    phone_num VARCHAR(20),

    CONSTRAINT fk_user_branch
        FOREIGN KEY (branch_id)
        REFERENCES BRANCH(branch_id)
);

CREATE TABLE MOVIE (
    movie_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    synopsis TEXT,
    duration INT NOT NULL,
    age_rating VARCHAR(20),
    language VARCHAR(50),
    base_price DECIMAL(10,2) NOT NULL,
    poster VARCHAR(255),
    director VARCHAR(150),
    release_date DATE
);

CREATE TABLE TOTAL_PURCHASE (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    purchase_datetime DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL,

    CONSTRAINT fk_total_purchase_user
        FOREIGN KEY (user_id)
        REFERENCES `USER`(user_id)
);

CREATE TABLE SCREENING (
    screening_id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT NOT NULL,
    cinema_id INT NOT NULL,
    show_date DATE NOT NULL,
    show_time TIME NOT NULL,
    status VARCHAR(50) NOT NULL,

    CONSTRAINT fk_screening_movie
        FOREIGN KEY (movie_id)
        REFERENCES MOVIE(movie_id),

    CONSTRAINT fk_screening_cinema
        FOREIGN KEY (cinema_id)
        REFERENCES CINEMA(cinema_id)
);

CREATE TABLE MOVIE_GENRE (
    movie_id INT NOT NULL,
    genre_id INT NOT NULL,

    PRIMARY KEY (movie_id, genre_id),

    CONSTRAINT fk_movie_genre_movie
        FOREIGN KEY (movie_id)
        REFERENCES MOVIE(movie_id),

    CONSTRAINT fk_movie_genre_genre
        FOREIGN KEY (genre_id)
        REFERENCES GENRE(genre_id)
);

CREATE TABLE MOVIE_CAST (
    movie_id INT NOT NULL,
    cast_id INT NOT NULL,

    PRIMARY KEY (movie_id, cast_id),

    CONSTRAINT fk_movie_cast_movie
        FOREIGN KEY (movie_id)
        REFERENCES MOVIE(movie_id),

    CONSTRAINT fk_movie_cast_cast
        FOREIGN KEY (cast_id)
        REFERENCES `CAST`(cast_id)
);

CREATE TABLE SNACK_PURCHASE (
    purchase_id INT NOT NULL,
    snack_id INT NOT NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    PRIMARY KEY (purchase_id, snack_id),

    CONSTRAINT fk_snack_purchase_purchase
        FOREIGN KEY (purchase_id)
        REFERENCES TOTAL_PURCHASE(purchase_id),

    CONSTRAINT fk_snack_purchase_snack
        FOREIGN KEY (snack_id)
        REFERENCES SNACK(snack_id)
);

CREATE TABLE TICKET (
    ticket_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    screening_id INT NOT NULL,
    seat_id INT NOT NULL,
    type_id INT NOT NULL,
    ticket_price DECIMAL(10,2) NOT NULL,
    booking_ref VARCHAR(100) NOT NULL,

    CONSTRAINT fk_ticket_purchase
        FOREIGN KEY (purchase_id)
        REFERENCES TOTAL_PURCHASE(purchase_id),

    CONSTRAINT fk_ticket_screening
        FOREIGN KEY (screening_id)
        REFERENCES SCREENING(screening_id),

    CONSTRAINT fk_ticket_seat
        FOREIGN KEY (seat_id)
        REFERENCES SEAT(seat_id),

    CONSTRAINT fk_ticket_type
        FOREIGN KEY (type_id)
        REFERENCES TICKET_TYPE(type_id)
);