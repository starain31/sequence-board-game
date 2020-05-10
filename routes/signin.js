const {authenticate, service} = require("../controller/signin");
const sign_in_router =  require('express').Router();

sign_in_router.post('/', authenticate, service);

module.exports = {sign_in_router};
