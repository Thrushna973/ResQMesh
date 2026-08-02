const twilio = require("twilio");
require("dotenv").config();

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * Sends an emergency SMS using Twilio.
 * Polls status to capture final delivery failures and maps common carrier/trial errors.
 * 
 * @param {Object} incident - The emergency incident payload.
 * @returns {Promise<Object>} Response object containing success, delivery status, and error details.
 */
exports.sendEmergencySMS = async (incident) => {
    const to = process.env.EMERGENCY_SMS_NUMBER;
    const from = process.env.TWILIO_PHONE_NUMBER;

    // 1. Validate phone numbers are in E.164 format (starts with '+')
    if (!to || !to.startsWith("+")) {
        console.error("SMS Error: Target number is missing or not in E.164 format (e.g. +919876543210).");
        return {
            success: false,
            sid: null,
            status: "failed",
            error_code: "INVALID_RECIPIENT",
            error_message: "Target number is missing or not in E.164 format (e.g. +919876543210)."
        };
    }

    if (!from || !from.startsWith("+")) {
        console.error("SMS Error: Twilio 'from' number is missing or not in E.164 format.");
        return {
            success: false,
            sid: null,
            status: "failed",
            error_code: "INVALID_SENDER",
            error_message: "Twilio 'from' number is missing or not in E.164 format."
        };
    }

    try {
        // Fetch account details to check if it's a Trial account
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        const isTrial = account.type === "Trial";

        if (isTrial) {
            console.warn("⚠️ TWILIO ACCOUNT IS A TRIAL ACCOUNT. Messages can ONLY be delivered to phone numbers that are verified in the Twilio Console under 'Verified Caller IDs'.");
        }

        // Send SMS
        let message = await client.messages.create({
            body:
`🚨 ResQMesh Emergency

Victim: ${incident.victim_name}

Emergency: ${incident.emergency_type}

Location:
https://maps.google.com/?q=${incident.latitude},${incident.longitude}

Message:
${incident.message}`,
            from: from,
            to: to
        });

        // 2. Poll Twilio status if it is queued or sending to get the final delivery receipt
        let attempts = 0;
        const maxAttempts = 6;
        while ((message.status === "queued" || message.status === "sending") && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            message = await client.messages(message.sid).fetch();
            attempts++;
        }

        // Print complete Twilio response details
        console.log("================ Twilio Response Details ================");
        console.log("SID:", message.sid);
        console.log("Status:", message.status);
        console.log("To:", message.to);
        console.log("From:", message.from);
        console.log("Error Code:", message.errorCode || "None");
        console.log("Error Message:", message.errorMessage || "None");
        console.log("========================================================");

        // Check if Twilio reports a delivery failure
        if (message.status === "failed" || message.status === "undelivered" || message.errorCode) {
            let errorMsg = message.errorMessage || "Message delivery failed.";
            let errCode = message.errorCode ? String(message.errorCode) : "DELIVERY_FAILED";

            // Map common Twilio error codes to explicit reasons
            if (message.errorCode === 21608) {
                errorMsg = "Trial accounts cannot send messages to unverified numbers. You must verify the recipient number in your Twilio Console.";
            } else if (message.errorCode === 21408) {
                errorMsg = "SMS Geographic Permission not enabled for the destination region in Twilio Console.";
            } else if (message.errorCode === 30007) {
                errorMsg = "Message blocked by carrier filtering (likely due to international carrier regulations or spam detection).";
            }

            return {
                success: false,
                sid: message.sid,
                status: message.status,
                error_code: errCode,
                error_message: errorMsg
            };
        }

        const delivered = message.status === "delivered" || message.status === "sent";

        return {
            success: true,
            sid: message.sid,
            status: message.status,
            delivered,
            error: null
        };

    } catch (error) {
        console.error("Twilio SMS API Error:", error.message);
        
        let errorMsg = error.message;
        let errCode = error.code ? String(error.code) : "API_ERROR";

        // Map common catch-block Twilio API exceptions
        if (error.code === 21608) {
            errorMsg = "Trial accounts cannot send messages to unverified numbers. You must verify the recipient number in your Twilio Console.";
        } else if (error.code === 21408) {
            errorMsg = "SMS Geographic Permission not enabled for the destination region in Twilio Console.";
        }

        return {
            success: false,
            sid: null,
            status: "failed",
            error_code: errCode,
            error_message: errorMsg
        };
    }
};