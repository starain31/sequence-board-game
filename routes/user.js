const {rateLimit} = require('express-rate-limit');
const user = require("../controller/user");
const router =  require('express').Router();

// Per client IP, in memory. Behind a reverse proxy, set TRUST_PROXY so the real client IP is used.
function limit({limit, minutes, skipSuccessfulRequests = false}) {
    return rateLimit({
        windowMs: minutes * 60 * 1000,
        limit,
        skipSuccessfulRequests,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {error: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Wait a few minutes and try again.'},
    });
}

// Only failed sign-ins count, so guessing passwords is slow but normal use is never blocked.
router.post('/signin', limit({limit: 10, minutes: 15, skipSuccessfulRequests: true}), user.signin);
router.post('/signup', limit({limit: 20, minutes: 60}), user.signup);
router.post('/signout', user.signout);

router.get('/profile', user.profile);
router.get('/rooms', user.rooms);
router.get('/current-game', user.current_game);

module.exports = router;
