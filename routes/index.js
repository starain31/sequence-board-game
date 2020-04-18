const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.send("Sequence Board Game: Coding just started");
});

module.exports = router;
