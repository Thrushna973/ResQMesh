const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({

    service: "gmail",

    auth: {

        user: process.env.EMAIL_USER,

        pass: process.env.EMAIL_PASS

    }

});

exports.sendEmergencyAlert = async (incident) => {

    try {

        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: process.env.ADMIN_EMAIL,

            subject: "🚨 ResQMesh Emergency Alert",

            html: `

            <h2>Emergency Received</h2>

            <p><b>Victim:</b> ${incident.victim_name}</p>

            <p><b>Phone:</b> ${incident.phone}</p>

            <p><b>Emergency:</b> ${incident.emergency_type}</p>

            <p><b>Message:</b> ${incident.message}</p>

            <p><b>Location:</b>

            ${incident.latitude},

            ${incident.longitude}</p>

            `

        });

        console.log("Emergency Email Sent");

    }

    catch(error){

        console.error(error);

    }

};

exports.sendTestEmail = async () => {

    await transporter.sendMail({

        from: process.env.EMAIL_USER,

        to: process.env.ADMIN_EMAIL,

        subject: "🚨 ResQMesh Test Email",

        html: `
            <h2>NodeMailer Working Successfully</h2>

            <p>Your ResQMesh backend is configured correctly.</p>
        `

    });

    console.log("Test Email Sent");

};