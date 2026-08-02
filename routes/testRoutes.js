const express = require("express");

const router = express.Router();

const { testEmail } = require("../Controllers/testController");

router.get("/test-email", testEmail);

module.exports = router;