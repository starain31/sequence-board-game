const session = require('express-session');
const PgSessionStore = require('connect-pg-simple')(session);
const {pool} = require('./database/pool');

// The session middleware, and its secret, which also signs the tokens game sockets use to say who they are.
const session_middleware = session({
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
});

function session_secret() {
    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET must be set in production.');
    }
    return 'development-only-session-secret';
}

module.exports = {session_middleware, session_secret};
