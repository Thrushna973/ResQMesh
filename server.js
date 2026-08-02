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

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173"
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

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

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ResQMesh Backend Running"
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

    console.error("Global Error Handler:", err);

    if (err.message === "Not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "CORS Error: Origin not allowed."
        });
    }

    res.status(err.status || 500).json({

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