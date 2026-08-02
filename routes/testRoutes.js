const express = require("express");

const router = express.Router();

const { testEmail } = require("../controllers/testController");

router.get("/test-email", testEmail);

module.exports = router;