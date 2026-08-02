const express = require("express");
const router = express.Router();
const { analyze } = require("../controllers/aiController");

// Mount the POST /analyze endpoint to trigger the AI analysis controller
router.post("/analyze", analyze);

module.exports = router;