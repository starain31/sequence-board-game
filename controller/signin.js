const {get_user} = require('../database/users');

function is_existing_user({handle, password}) {
    return get_user({handle})
        .then(function (user) {
            return user !== undefined && user.password === password;
        });
}

function authenticate(req, res, next) {
    is_existing_user(req.body)
        .then(function (is_valid_user) {
            if(!is_valid_user) {
                req.session.error = 'Authentication failed, please check your '
                    + ' username and password.';
                return res.redirect('back');
            }
            req.session.regenerate(async function() {
                req.session.handle = req.body.handle;
                req.session.success = 'Authenticated as ' + req.body.handle;
                next();
            });
        });
}

function service(req, res) {
    res.redirect('/views/lobby.html');
}

module.exports = {authenticate, service};
