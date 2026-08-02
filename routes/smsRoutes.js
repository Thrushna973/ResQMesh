const express = require("express");

const router = express.Router();

const {

testSMS

} = require("../Controllers/testSMSController");

router.get("/test-sms",testSMS);

module.exports = router;