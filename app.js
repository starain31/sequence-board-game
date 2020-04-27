const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const  {game_router} = require("./routes/game");
const  {board_router} = require("./routes/board");

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/game', game_router);
app.use('/board', board_router);

module.exports = app;
