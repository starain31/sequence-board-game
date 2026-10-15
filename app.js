const express = require('express');
const path = require('path');
const logger = require('morgan');
const {ping} = require('./database/pool');
const {session_middleware} = require('./session');


const  user_router = require("./routes/user");
const  {room_router} = require("./routes/room");
const  {game_router} = require("./routes/game");
const  {board_router} = require("./routes/board");

const app = express();

// Behind a reverse proxy (e.g. TRUST_PROXY=1 for one hop), so req.ip is the client's address, which the
// sign-in rate limit relies on. See https://expressjs.com/en/guide/behind-proxies.html
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
}

// Jest sets NODE_ENV=test; request logs would bury the test output.
if (process.env.NODE_ENV !== 'test') {
    app.use(logger('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session_middleware);

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

module.exports = app;
