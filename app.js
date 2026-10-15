const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const PgSessionStore = require('connect-pg-simple')(session);
const {pool, ping} = require('./database/pool');


const  user_router = require("./routes/user");
const  {room_router} = require("./routes/room");
const  {game_router} = require("./routes/game");
const  {board_router} = require("./routes/board");

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    // Sessions live in PostgreSQL, so a restart doesn't sign everyone out.
    store: new PgSessionStore({pool, tableName: 'session'}),
    secret: session_secret(),
    resave: false,
    saveUninitialized: false,
    // Each request pushes the expiry back, so only a week of inactivity signs a user out.
    rolling: true,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        // Set COOKIE_SECURE=true when the app is served over HTTPS.
        secure: process.env.COOKIE_SECURE === 'true',
    },
}));

app.get('/health', function (req, res) {
    ping()
        .then(function () {
            res.send({status: 'ok', database: 'up'});
        })
        .catch(function () {
            res.status(503).send({status: 'error', database: 'down'});
        });
});

app.use('/user', user_router);
app.use('/room', room_router);
app.use('/game', game_router);
app.use('/board', board_router);

function session_secret() {
    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET must be set in production.');
    }
    return 'development-only-session-secret';
}

module.exports = app;
