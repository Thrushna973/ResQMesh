const { analyzeEmergency } = require("../services/aiService");

/**
 * Controller to handle AI analysis of emergency reports.
 * POST /api/ai/analyze
 * 
 * Input body:
 * {
 *    "reports": [
 *       "Building A collapsed",
 *       "People trapped inside Building A"
 *    ]
 * }
 */
exports.analyze = async (req, res) => {
    try {
        const { reports } = req.body;

        // Validation: check if reports array is provided and is an array
        if (!reports || !Array.isArray(reports)) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: 'reports' must be a non-empty array of strings."
            });
        }

        // Validate that all items in the array are strings
        const hasInvalidItem = reports.some(item => typeof item !== "string");
        if (hasInvalidItem) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: All elements in the 'reports' array must be strings."
            });
        }

        // Sanitize and filter out empty reports
        const sanitizedReports = reports.map(r => r.trim()).filter(r => r.length > 0);
        if (sanitizedReports.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: 'reports' array must contain at least one non-empty string."
            });
        }

        // Call the Gemini service to analyze the reports
        const result = await analyzeEmergency(sanitizedReports);

        // Return the JSON result directly
        return res.status(200).json(result);

    } catch (error) {
        console.error("Error in aiController.analyze:", error);
        
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AI analysis.",
            error: error.message
        });
    }
};

// Maintain compatibility with any existing route using testAI
exports.testAI = exports.analyze;