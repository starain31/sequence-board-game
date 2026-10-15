-- Login sessions for express-session, in the layout connect-pg-simple expects (its table.sql).
-- Expired rows are pruned by the store every 15 minutes.
CREATE TABLE session (
    sid    VARCHAR      NOT NULL PRIMARY KEY,
    sess   JSON         NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX session_expire_index ON session (expire);
