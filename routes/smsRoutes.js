const express = require("express");

const router = express.Router();

const {

testSMS

} = require("../controllers/testSMSController");

router.get("/test-sms",testSMS);

module.exports = router;