require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const testRoutes = require("./routes/testRoutes");
const smsRoutes = require("./routes/smsRoutes");
const aiRoutes = require("./routes/aiRoutes");





// Database Connection
require("./config/db");

const emergencyRoutes = require("./routes/emergencyRoutes");

const app = express();

/*
|--------------------------------------------------------------------------
| Security Middleware
|--------------------------------------------------------------------------
*/

app.use(helmet());

app.use(compression());

app.use(cors());

app.use(express.json({
    limit: "1mb"
}));

app.use(express.urlencoded({
    extended: true
}));

app.use("/api", testRoutes);
app.use("/api",smsRoutes);
app.use("/api/ai", aiRoutes);
/*
|--------------------------------------------------------------------------
| Rate Limiter
|--------------------------------------------------------------------------
*/

const limiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 100,

    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }

});

app.use(limiter);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {

    res.status(200).json({

        success: true,

        application: "ResQMesh Backend",

        status: "Running"

    });

});

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use("/api/emergency", emergencyRoutes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message: "Route Not Found"

    });

});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({

        success: false,

        message: "Internal Server Error"

    });

});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log("================================");

    console.log("🚑 ResQMesh Backend Started");

    console.log(`🌐 Server : http://localhost:${PORT}`);

    console.log("================================");

});