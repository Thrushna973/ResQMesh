const express = require("express");

const router = express.Router();

const {
    uploadEmergency,
    getPendingEmergencies,
    processEmergency
} = require("../Controllers/emergencyController");

router.post("/upload", uploadEmergency);
router.get("/pending", getPendingEmergencies);
router.post("/process", processEmergency);

module.exports = router;