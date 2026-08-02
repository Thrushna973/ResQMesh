const nodemailer = require("nodemailer");
require("dotenv").config();

// Create Gmail Transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Sends an emergency alert email.
 * 
 * @param {Object} incident - The emergency incident payload.
 */
exports.sendEmergencyEmail = async (incident) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: "🚨 ResQMesh Emergency Alert",
            html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff; color: #333333;">
              <div style="background-color: #d32f2f; color: #ffffff; padding: 15px; border-radius: 6px 6px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">🚨 ResQMesh Emergency Alert</h1>
              </div>
              <div style="padding: 20px; line-height: 1.6;">
                <p style="font-size: 16px; margin-top: 0;">An emergency incident has been reported and requires immediate attention.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; width: 35%; border-bottom: 1px solid #f0f0f0;">Victim Name:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${incident.victim_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Phone Number:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${incident.phone}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Emergency Type:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #d32f2f; font-weight: bold;">${incident.emergency_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Message:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${incident.message}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Location Coordinates:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${incident.latitude}, ${incident.longitude}</td>
                  </tr>
                </table>
                
                <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                  <a href="https://www.google.com/maps?q=${incident.latitude},${incident.longitude}" target="_blank" style="background-color: #d32f2f; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    📍 View Incident Location
                  </a>
                </div>
              </div>
              <div style="background-color: #f8f9fa; text-align: center; padding: 10px; font-size: 12px; color: #777777; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
                Sent automatically by ResQMesh Emergency Response System.
              </div>
            </div>
            `
        });
        console.log("Emergency Email Sent");
    } catch (error) {
        console.error("Email Service Error:", error);
        throw error;
    }
};
