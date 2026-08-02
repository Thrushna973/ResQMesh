const notificationService = require("../services/notificationService");

exports.testEmail = async (req, res) => {

    try {

        await notificationService.sendTestEmail();

        res.json({
            success: true,
            message: "Test email sent successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to send email."
        });

    }

};