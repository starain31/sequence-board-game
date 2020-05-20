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
                return res.status(400).send('INVALID_USER_NAME_OR_PASSWORD');
            }
            req.session.regenerate(async function() {
                req.session.handle = req.body.handle;
                req.session.success = 'Authenticated as ' + req.body.handle;
                next();
            });
        });
}

function service(req, res) {
    res.status(200).send();
}

function get_profile_info(req, res) {
    const handle = req.session.handle;
    return get_user({handle})
        .then(function (user) {
            res.send({ handle, name: user.name });
        });
}


module.exports = {authenticate, service, get_profile_info};
