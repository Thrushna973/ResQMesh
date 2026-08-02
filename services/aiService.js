const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

// Initialize GoogleGenAI SDK with the API key from environment variables
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// List of allowed incident categories
const ALLOWED_INCIDENTS = [
  "Accident",
  "Medical",
  "Fire",
  "Flood",
  "Earthquake",
  "Building Collapse",
  "Landslide",
  "Other"
];

// List of allowed priority levels
const ALLOWED_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

// Fallback models to try in sequence in case of quota (429) or availability issues
const MODELS_TO_TRY = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-1.5-flash"
];

/**
 * Analyzes a collection of emergency reports and extracts key insights.
 * Handles both single-incident (same_incident: true) and multi-incident (same_incident: false) outputs.
 * 
 * @param {string[]} reports - An array of emergency reports. If a single string is provided, it is wrapped in an array.
 * @returns {Promise<Object>} The structured JSON analysis containing the incident details or a list of separate incidents.
 */
async function analyzeEmergency(reports) {
  // Input Validation & Standardization
  let reportList = [];
  if (Array.isArray(reports)) {
    reportList = reports;
  } else if (typeof reports === "string") {
    reportList = [reports];
  } else {
    throw new TypeError("Invalid input: reports must be an array of strings or a single string.");
  }

  // Ensure there is at least one report to analyze
  if (reportList.length === 0) {
    throw new Error("Invalid input: reports array cannot be empty.");
  }

  // Sanitize the inputs (remove empty strings or non-string elements)
  reportList = reportList
    .map(r => (typeof r === "string" ? r.trim() : ""))
    .filter(r => r.length > 0);

  if (reportList.length === 0) {
    throw new Error("Invalid input: reports must contain at least one non-empty string.");
  }

  const prompt = `You are an AI Emergency Response Assistant.
Analyze the following emergency reports:
${JSON.stringify(reportList, null, 2)}

Instructions:
1. First, determine whether all reports describe the SAME incident or DIFFERENT incidents. Set 'same_incident' accordingly.
2. If they describe the SAME incident, populate: 'incident', 'priority', 'summary', and 'duplicate_analysis'.
3. If they describe DIFFERENT incidents, populate: 'incidents' array with individual analyses (incident, priority, summary for each) and 'duplicate_analysis'.`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      same_incident: {
        type: "BOOLEAN"
      },
      incident: {
        type: "STRING",
        enum: ALLOWED_INCIDENTS,
        description: "Populate ONLY if same_incident is true."
      },
      priority: {
        type: "STRING",
        enum: ALLOWED_PRIORITIES,
        description: "Populate ONLY if same_incident is true."
      },
      reports: {
        type: "INTEGER",
        description: "Total number of reports analyzed."
      },
      summary: {
        type: "STRING",
        description: "Concise summary sentence. Populate ONLY if same_incident is true."
      },
      duplicate_analysis: {
        type: "STRING",
        description: "Explanation of whether all reports refer to the same incident or separate events."
      },
      incidents: {
        type: "ARRAY",
        description: "Populate ONLY if same_incident is false.",
        items: {
          type: "OBJECT",
          properties: {
            incident: {
              type: "STRING",
              enum: ALLOWED_INCIDENTS
            },
            priority: {
              type: "STRING",
              enum: ALLOWED_PRIORITIES
            },
            summary: {
              type: "STRING"
            }
          },
          required: ["incident", "priority", "summary"]
        }
      }
    },
    required: ["same_incident", "reports", "duplicate_analysis"]
  };

  let lastError = null;

  // Try each model in sequence
  for (const model of MODELS_TO_TRY) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      if (!response || !response.text) {
        throw new Error("No response or text returned from the Gemini API.");
      }

      // Clean potential markdown wrappers and parse JSON response
      let cleanedText = response.text.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText
          .replace(/^```json\s*/i, "")
          .replace(/```$/, "")
          .trim();
      }

      const parsedData = JSON.parse(cleanedText);

      // Build the output depending on whether they are the same or different incidents
      if (parsedData.same_incident) {
        const incident = ALLOWED_INCIDENTS.includes(parsedData.incident)
          ? parsedData.incident
          : "Other";

        const priority = ALLOWED_PRIORITIES.includes(parsedData.priority)
          ? parsedData.priority
          : "Medium";

        return {
          same_incident: true,
          incident,
          priority,
          reports: reportList.length,
          summary: parsedData.summary || "Summary could not be generated.",
          duplicate_analysis: parsedData.duplicate_analysis || ""
        };
      } else {
        const incidentsList = (Array.isArray(parsedData.incidents) ? parsedData.incidents : []).map(inc => {
          return {
            incident: ALLOWED_INCIDENTS.includes(inc.incident) ? inc.incident : "Other",
            priority: ALLOWED_PRIORITIES.includes(inc.priority) ? inc.priority : "Medium",
            summary: inc.summary || ""
          };
        });

        return {
          same_incident: false,
          reports: reportList.length,
          duplicate_analysis: parsedData.duplicate_analysis || "",
          incidents: incidentsList
        };
      }

    } catch (error) {
      console.warn(`Model ${model} failed in analyzeEmergency: ${error.message}`);
      lastError = error;
    }
  }

  // Fallback to safe defaults if all models fail
  console.error("All models failed in analyzeEmergency. Returning fallback.", lastError);
  return {
    same_incident: true,
    incident: "Other",
    priority: "Medium",
    reports: reportList.length,
    summary: "Error occurred during emergency analysis.",
    duplicate_analysis: "Unable to analyze duplicates due to service failure."
  };
}

/**
 * Detects if a new report refers to the same incident as any of the existing reports using AI.
 * 
 * @param {string} newReport - The incoming emergency message.
 * @param {Array<{id: number, message: string}>} existingReports - A list of recent reports.
 * @returns {Promise<Object>} The JSON response with same_incident, confidence, reason, and matching_id.
 */
async function checkAIDuplicate(newReport, existingReports) {
  if (!newReport || typeof newReport !== "string") {
    throw new TypeError("newReport must be a non-empty string.");
  }
  if (!Array.isArray(existingReports)) {
    throw new TypeError("existingReports must be an array.");
  }

  if (existingReports.length === 0) {
    return {
      same_incident: false,
      confidence: 1.0,
      reason: "No prior reports available for comparison.",
      matching_id: null
    };
  }

  const prompt = `You are an AI Emergency Response Assistant.
Determine if the new report describes the same incident as any of the previous reports, even if the wording or phrasing is different.
Reports describe the same incident if they refer to the same event, same location, same entities, or logical consequences of the same hazard (e.g. "Building A collapsed" and "People trapped inside Building A" refer to the same collapse incident).

New Report:
"${newReport}"

Previous Reports:
${JSON.stringify(existingReports, null, 2)}

Provide your decision and explain your reasoning.`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      same_incident: {
        type: "BOOLEAN"
      },
      confidence: {
        type: "NUMBER"
      },
      reason: {
        type: "STRING"
      },
      matching_id: {
        type: "INTEGER",
        description: "The id of the matching previous report if same_incident is true, otherwise null."
      }
    },
    required: ["same_incident", "confidence", "reason", "matching_id"]
  };

  let lastError = null;

  // Try each model in sequence
  for (const model of MODELS_TO_TRY) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      if (!response || !response.text) {
        throw new Error("Empty response from duplicate detection model.");
      }

      let cleanedText = response.text.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText
          .replace(/^```json\s*/i, "")
          .replace(/```$/, "")
          .trim();
      }

      return JSON.parse(cleanedText);

    } catch (error) {
      console.warn(`Model ${model} failed in checkAIDuplicate: ${error.message}`);
      lastError = error;
    }
  }

  console.error("All models failed in checkAIDuplicate. Returning fallback.", lastError);
  return {
    same_incident: false,
    confidence: 0.5,
    reason: "Duplicate detection failed due to an error.",
    matching_id: null
  };
}

module.exports = {
  analyzeEmergency,
  checkAIDuplicate
};