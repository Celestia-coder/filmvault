SET SQL_SAFE_UPDATES = 0;

UPDATE filmvault.`USER`
SET password = '$2b$10$mo1ogcGDNQxeEwqhV9CyheM5y4gmv/o4Bgf1xwIA7degpbuh3Zdni'
WHERE email = 'tester@filmvault.com' OR user_id = 1;

SET SQL_SAFE_UPDATES = 1;

SELECT user_id, email, LEFT(password, 7) AS hash_start FROM filmvault.`USER`
WHERE email = 'tester@filmvault.com' OR user_id = 1;
