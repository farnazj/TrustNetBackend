var db = require('../models');
var express = require('express');
var routeHelpers = require('../lib/routeHelpers');
var router = express.Router();


router.get('/', routeHelpers.isLoggedIn, async function(req, res, next) {
    res.redirect('/boosts');
});

module.exports = router;
