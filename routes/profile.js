const profile_router =  require('express').Router();
const {get_profile_info} = require('../controller/profile');

profile_router.get('/', get_profile_info);

module.exports = {profile_router};
