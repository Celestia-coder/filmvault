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