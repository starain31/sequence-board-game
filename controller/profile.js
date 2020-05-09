const {get_user} = require('../database/users');

function get_profile_info(req, res) {
    const handle = req.session.handle;
    return get_user({handle})
        .then(function (user) {
            res.send({ handle, name: user.name });
        });
}

module.exports = {get_profile_info};
