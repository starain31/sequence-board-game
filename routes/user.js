const user = require("../controller/user");
const router =  require('express').Router();

router.post('/signin', user.signin);
router.post('/signup', function (req, res) {
    res.status(200).send();
});

router.get('/profile', user.profile);

module.exports = router;
