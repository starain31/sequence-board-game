const {authenticate, service, get_profile_info} = require("../controller/user");
const router =  require('express').Router();

router.post('/signin', authenticate, service);
router.post('/signup', function (req, res) {
    res.status(200).send();
});

router.get('/profile', get_profile_info);

module.exports = router;
