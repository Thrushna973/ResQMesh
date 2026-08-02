const db = require("../config/db");
const crypto = require("crypto");
const notificationService = require("../services/notificationService");
// ==============================
// CONSTANTS
// ==============================


const ALLOWED_EMERGENCY_TYPES = [
    "Accident",
    "Medical",
    "Fire",
    "Flood",
    "Earthquake",
    "Landslide",
    "Gas Leak",
    "Other"
];

const ALLOWED_NETWORKS = [
    "BLE Mesh",
    "Wi-Fi Direct",
    "Internet"
];

// ==============================
// HELPER FUNCTIONS
// ==============================

// Calculate distance in km between two coordinates using Haversine formula
const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Remove unwanted spaces
const sanitize = (value) => {
    if (typeof value !== "string") return value;
    return value.trim();
};

// Generate unique fingerprint
const generateFingerprint = ({
    phone,
    latitude,
    longitude,
    emergency_type,
    message
}) => {

    return crypto
        .createHash("sha256")
        .update(
            `${phone}|${latitude}|${longitude}|${emergency_type}|${message}`
        )
        .digest("hex");
};

// ==============================
// VALIDATION
// ==============================

const validateEmergencyPacket = (data) => {

    const errors = [];

    const {
        victim_name,
        phone,
        latitude,
        longitude,
        emergency_type,
        message,
        network_used
    } = data;

    // Required fields

    if (!victim_name || !victim_name.trim()) {
        errors.push("Victim name is required.");
    }

    if (!phone || !phone.trim()) {
        errors.push("Phone number is required.");
    }

    if (latitude === undefined || latitude === null) {
        errors.push("Latitude is required.");
    }

    if (longitude === undefined || longitude === null) {
        errors.push("Longitude is required.");
    }

    if (!emergency_type || !emergency_type.trim()) {
        errors.push("Emergency type is required.");
    }

    if (!message || !message.trim()) {
        errors.push("Emergency message is required.");
    }

    if (!network_used || !network_used.trim()) {
        errors.push("Network type is required.");
    }

    // Phone

    if (
        phone &&
        !/^[6-9]\d{9}$/.test(phone)
    ) {
        errors.push("Invalid Indian mobile number.");
    }

    // Coordinates

    if (
        latitude < -90 ||
        latitude > 90
    ) {
        errors.push("Latitude must be between -90 and 90.");
    }

    if (
        longitude < -180 ||
        longitude > 180
    ) {
        errors.push("Longitude must be between -180 and 180.");
    }

    // Emergency type

    if (
        emergency_type &&
        !ALLOWED_EMERGENCY_TYPES.includes(emergency_type)
    ) {
        errors.push("Invalid emergency type.");
    }

    // Network

    if (
        network_used &&
        !ALLOWED_NETWORKS.includes(network_used)
    ) {
        errors.push("Invalid network type.");
    }

    // Length validations

    if (
        victim_name &&
        victim_name.length > 100
    ) {
        errors.push("Victim name is too long.");
    }

    if (
        message &&
        message.length > 1000
    ) {
        errors.push("Emergency message exceeds 1000 characters.");
    }

    return errors;
};

// ==============================
// DUPLICATE CHECK
// ==============================

const checkDuplicate = (fingerprint) => {

    return new Promise((resolve, reject) => {

        const sql = `
            SELECT id
            FROM emergency_messages
            WHERE fingerprint = ?
            LIMIT 1
        `;

        db.query(sql, [fingerprint], (err, results) => {

            if (err) {
                return reject(err);
            }

            if (results.length > 0) {
                return resolve(results[0]);
            }

            resolve(null);

        });

    });

};
// ==========================================
// UPLOAD EMERGENCY PACKET
// ==========================================

exports.uploadEmergency = async (req, res) => {

    try {

        // -------------------------
        // Sanitize Input
        // -------------------------

        const emergencyData = {
            victim_name: sanitize(req.body.victim_name),
            phone: sanitize(req.body.phone),
            latitude: Number(req.body.latitude),
            longitude: Number(req.body.longitude),
            emergency_type: sanitize(req.body.emergency_type),
            message: sanitize(req.body.message),
            network_used: sanitize(req.body.network_used),

            // Mesh Information
            // packet_id: sanitize(req.body.packet_id),
            // hop_count: Number(req.body.hop_count || 0),
            // relay_device_id: sanitize(req.body.relay_device_id)
        };

        // -------------------------
        // Validate
        // -------------------------

        const errors = validateEmergencyPacket(emergencyData);

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation Failed",
                errors
            });
        }

        // -------------------------
        // Generate Fingerprint
        // -------------------------

        const fingerprint = generateFingerprint(emergencyData);

        // -------------------------
        // Duplicate Check
        // -------------------------

        const existingEmergency = await checkDuplicate(fingerprint);

        if (existingEmergency) {

            return res.status(200).json({
                success: true,
                duplicate: true,
                message: "Emergency packet already received.",
                emergencyId: existingEmergency.id
            });

        }

        // -------------------------
        // AI Duplicate Check
        // -------------------------

        const recentMessages = await new Promise((resolve) => {
            db.query(
                `SELECT id, message, latitude, longitude FROM emergency_messages WHERE created_at >= NOW() - INTERVAL 2 HOUR ORDER BY created_at DESC LIMIT 15`,
                (err, results) => {
                    if (err) {
                        console.error("Error fetching recent messages for AI duplicate check:", err);
                        resolve([]);
                    } else {
                        // Only compare with reports located within a 2.0 km radius
                        const nearby = (results || []).filter(msg => {
                            const distance = getHaversineDistance(
                                emergencyData.latitude,
                                emergencyData.longitude,
                                msg.latitude,
                                msg.longitude
                            );
                            return distance <= 2.0; // 2 km threshold
                        });
                        resolve(nearby);
                    }
                }
            );
        });

        if (recentMessages.length > 0) {
            const { checkAIDuplicate } = require("../services/aiService");
            const aiDupResult = await checkAIDuplicate(emergencyData.message, recentMessages);

            if (aiDupResult.same_incident && aiDupResult.confidence >= 0.8) {
                return res.status(200).json({
                    success: true,
                    duplicate: true,
                    message: "Emergency packet identified as duplicate by AI.",
                    emergencyId: aiDupResult.matching_id,
                    ai_duplicate_analysis: aiDupResult
                });
            }
        }

        // -------------------------
        // Insert Emergency
        // -------------------------

        const sql = `
            INSERT INTO emergency_messages
            (
                victim_name,
                phone,
                latitude,
                longitude,
                emergency_type,
                message,
                network_used,
                fingerprint
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                emergencyData.victim_name,
                emergencyData.phone,
                emergencyData.latitude,
                emergencyData.longitude,
                emergencyData.emergency_type,
                emergencyData.message,
                emergencyData.network_used,

                // emergencyData.packet_id,
                // emergencyData.hop_count,
                // emergencyData.relay_device_id,

                fingerprint
            ],
            async (err, result) => {

                if (err) {

                    console.error("Upload Emergency:", err);

                    // Unique fingerprint violation
                    if (err.code === "ER_DUP_ENTRY") {

                        return res.status(409).json({
                            success: false,
                            message: "Duplicate emergency detected."
                        });

                    }

                    return res.status(500).json({
                        success: false,
                        message: "Unable to save emergency packet."
                    });

                }

                const messageId = result.insertId;

                try {
                    const { analyzeEmergency } = require("../services/aiService");
                    const aiResult = await analyzeEmergency([emergencyData.message]);

                    // Store incident (by updating emergency_messages.emergency_type and setting status = 'Processed')
                    const updateMsgSql = `
                        UPDATE emergency_messages 
                        SET emergency_type = ?, status = 'Processed' 
                        WHERE id = ?
                    `;
                    
                    db.query(updateMsgSql, [aiResult.incident, messageId], (updateErr) => {
                        if (updateErr) console.error("Failed to update incident type:", updateErr);
                    });

                    // Store priority and summary inside processed_incidents table
                    const insertProcessedSql = `
                        INSERT INTO processed_incidents (message_id, severity, ai_summary, rescue_team)
                        VALUES (?, ?, ?, ?)
                    `;

                    db.query(
                        insertProcessedSql,
                        [messageId, aiResult.priority, aiResult.summary, "Pending"],
                        async (processedErr) => {
                            if (processedErr) {
                                console.error("Failed to store processed incident details:", processedErr);
                            }

                            let email_sent = false;
                            let sms_sent = false;

                            const incidentPayload = {
                                victim_name: emergencyData.victim_name,
                                phone: emergencyData.phone,
                                emergency_type: aiResult.incident,
                                message: emergencyData.message,
                                latitude: emergencyData.latitude,
                                longitude: emergencyData.longitude,
                                network_used: emergencyData.network_used
                            };

                            // Send Email
                            try {
                                const { sendEmergencyEmail } = require("../services/emailService");
                                await sendEmergencyEmail(incidentPayload);
                                email_sent = true;
                            } catch (emailError) {
                                console.error("Email delivery failed:", emailError.message);
                            }

                            // Send SMS (continues even if email fails)
                            let smsResult = { success: false, status: "failed" };
                            try {
                                const { sendEmergencySMS } = require("../services/smsService");
                                smsResult = await sendEmergencySMS(incidentPayload);
                                sms_sent = smsResult.success;
                            } catch (smsError) {
                                console.error("SMS delivery failed:", smsError.message);
                                smsResult = {
                                    success: false,
                                    sid: null,
                                    status: "failed",
                                    error_code: "CATCH_ERROR",
                                    error_message: smsError.message
                                };
                            }

                            return res.status(201).json({
                                success: true,
                                email_sent,
                                sms_sent,
                                sms_details: smsResult,
                                incident: aiResult.incident,
                                priority: aiResult.priority,
                                summary: aiResult.summary
                            });
                        }
                    );

                } catch (aiError) {
                    console.error("Error in AI analysis during upload:", aiError);

                    let email_sent = false;
                    let sms_sent = false;

                    const fallbackPayload = {
                        victim_name: emergencyData.victim_name,
                        phone: emergencyData.phone,
                        emergency_type: emergencyData.emergency_type,
                        message: emergencyData.message,
                        latitude: emergencyData.latitude,
                        longitude: emergencyData.longitude,
                        network_used: emergencyData.network_used
                    };

                    try {
                        const { sendEmergencyEmail } = require("../services/emailService");
                        await sendEmergencyEmail(fallbackPayload);
                        email_sent = true;
                    } catch (emailError) {
                        console.error("Fallback Email delivery failed:", emailError.message);
                    }

                    let smsResult = { success: false, status: "failed" };
                    try {
                        const { sendEmergencySMS } = require("../services/smsService");
                        smsResult = await sendEmergencySMS(fallbackPayload);
                        sms_sent = smsResult.success;
                    } catch (smsError) {
                        console.error("Fallback SMS delivery failed:", smsError.message);
                        smsResult = {
                            success: false,
                            sid: null,
                            status: "failed",
                            error_code: "CATCH_ERROR",
                            error_message: smsError.message
                        };
                    }

                    return res.status(201).json({
                        success: true,
                        email_sent,
                        sms_sent,
                        sms_details: smsResult,
                        incident: emergencyData.emergency_type,
                        priority: "Medium",
                        summary: "AI analysis skipped due to error."
                    });
                }

            }
        );

    } catch (error) {

        console.error("Upload Controller:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

};
// ==========================================
// GET ALL PENDING EMERGENCIES
// ==========================================

exports.getPendingEmergencies = (req, res) => {

    const sql = `
        SELECT
            id,
            victim_name,
            phone,
            latitude,
            longitude,
            emergency_type,
            message,
            network_used,
            status,
            created_at
        FROM emergency_messages
        WHERE status = 'Pending'
        ORDER BY created_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.error("Fetch Pending:", err);

            return res.status(500).json({
                success: false,
                message: "Unable to fetch pending emergencies."
            });

        }

        return res.status(200).json({

            success: true,

            count: results.length,

            data: results

        });

    });

};


// ==========================================
// PROCESS EMERGENCY
// ==========================================

exports.processEmergency = (req, res) => {

    const {

        message_id,
        severity,
        ai_summary,
        rescue_team

    } = req.body;

    // -----------------------
    // Basic Validation
    // -----------------------

    if (
        !message_id ||
        !severity ||
        !ai_summary ||
        !rescue_team
    ) {

        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });

    }

    const allowedSeverity = [
        "Low",
        "Medium",
        "High",
        "Critical"
    ];

    if (!allowedSeverity.includes(severity)) {

        return res.status(400).json({
            success: false,
            message: "Invalid severity."
        });

    }

    // -----------------------
    // Begin Transaction
    // -----------------------

    db.beginTransaction((transactionError) => {

        if (transactionError) {

            console.error(transactionError);

            return res.status(500).json({
                success: false,
                message: "Failed to start transaction."
            });

        }

        // -----------------------
        // Check Emergency Exists
        // -----------------------

        const checkEmergency = `
            SELECT id,status
            FROM emergency_messages
            WHERE id=?
        `;

        db.query(
            checkEmergency,
            [message_id],
            (err, emergencyRows) => {

                if (err) {

                    return db.rollback(() => {

                        console.error(err);

                        return res.status(500).json({
                            success: false,
                            message: "Database Error."
                        });

                    });

                }

                if (emergencyRows.length === 0) {

                    return db.rollback(() => {

                        return res.status(404).json({
                            success: false,
                            message: "Emergency not found."
                        });

                    });

                }

                if (
                    emergencyRows[0].status ===
                    "Processed"
                ) {

                    return db.rollback(() => {

                        return res.status(409).json({
                            success: false,
                            message: "Emergency already processed."
                        });

                    });

                }

                // -----------------------
                // Store AI Result
                // -----------------------

                const insertIncident = `
                    INSERT INTO processed_incidents
                    (
                        message_id,
                        severity,
                        ai_summary,
                        rescue_team
                    )
                    VALUES(?,?,?,?)
                `;

                db.query(
                    insertIncident,
                    [
                        message_id,
                        severity,
                        ai_summary,
                        rescue_team
                    ],
                    (insertErr) => {

                        if (insertErr) {

                            return db.rollback(() => {

                                console.error(insertErr);

                                return res.status(500).json({
                                    success: false,
                                    message: "Unable to save processed incident."
                                });

                            });

                        }

                        // -----------------------
                        // Update Emergency Status
                        // -----------------------

                        const updateEmergency = `
                            UPDATE emergency_messages
                            SET status='Processed'
                            WHERE id=?
                        `;

                        db.query(
                            updateEmergency,
                            [message_id],
                            (updateErr) => {

                                if (updateErr) {

                                    return db.rollback(() => {

                                        console.error(updateErr);

                                        return res.status(500).json({
                                            success: false,
                                            message: "Unable to update emergency status."
                                        });

                                    });

                                }

                                // -----------------------
                                // Commit
                                // -----------------------

                                db.commit((commitErr) => {

                                    if (commitErr) {

                                        return db.rollback(() => {

                                            console.error(commitErr);

                                            return res.status(500).json({
                                                success: false,
                                                message: "Transaction failed."
                                            });

                                        });

                                    }

                                    return res.status(200).json({

                                        success: true,

                                        message:
                                            "Emergency processed successfully.",

                                        data: {

                                            emergencyId: message_id,

                                            severity,

                                            status: "Processed"

                                        }

                                    });

                                });

                            }
                        );

                    }
                );

            }
        );

    });

};