const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');


const  {sign_in_router} = require("./routes/signin");
const  {profile_router} = require("./routes/profile");
const  {room_router} = require("./routes/room");
const  {game_router} = require("./routes/game");
const  {board_router} = require("./routes/board");

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    cookie: { expires: 60 * 60 * 1000 },
    secret: 'work hard',
    resave: true,
    rolling: true,
    saveUninitialized: false
}));

app.use('/signin', sign_in_router);
app.use('/profile', profile_router);
app.use('/room', room_router);
app.use('/game', game_router);
app.use('/board', board_router);

module.exports = app;
