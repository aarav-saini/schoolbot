// app.js - Express.js Server
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const path = require("path");

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000; // Use port from environment or default to 3000

// Initialize Google GenAI with API key
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const REQUIRED_ACCESS_TOKEN = process.env.ACCESS_TOKEN;
if (!REQUIRED_ACCESS_TOKEN) {
    console.error(
        "Error: ACCESS_TOKEN is not set in environment variables. Please set it in your .env file."
    );
    process.exit(1);
} else {
    console.log("Access token loaded successfully for server-side validation.");
}

let schoolData; // Variable to hold the loaded school data

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

/**
 * Middleware to convert plain text newlines (\n) to HTML <br> tags.
 * This is useful if the AI sometimes returns plain text with newlines
 * that need to be rendered as actual line breaks in HTML.
 */
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        if (
            body &&
            typeof body === "object" &&
            body.response &&
            typeof body.response === "string"
        ) {
            if (
                !body.response.includes("<br>") &&
                !body.response.includes("<table") &&
                !body.response.includes("<p>") &&
                !body.response.includes("<div")
            ) {
                body.response = body.response.replace(/\n/g, "<br>");
            }
        }
        originalJson.call(this, body);
    };
    next();
});

/**
 * Loads school data from the 'school_data.json' file.
 * This function is called once when the server starts.
 */
async function loadSchoolData() {
    try {
        const data = await fs.readFile(
            path.join(__dirname, "school_data.json"),
            "utf8"
        );
        schoolData = data;
        console.log("School data loaded successfully.");
    } catch (error) {
        console.error("Failed to load school data:", error);
        console.log(
            "Error: Could not load school information. Please ensure 'school_data.json' exists and is accessible."
        );
        process.exit(1);
    }
}

// Login Endpoint
app.post("/login", (req, res) => {
    const { accessToken } = req.body;
    const clientIp = req.ip; // Get client IP

    if (!accessToken) {
        console.warn(`[${clientIp}] Login failed: Access token is required.`);
        return res.status(400).json({ error: "Access token is required." });
    }

    if (accessToken === REQUIRED_ACCESS_TOKEN) {
        console.log(`[${clientIp}] Login successful.`);
        return res.json({ message: "Login successful!" });
    } else {
        console.warn(`[${clientIp}] Login failed: Invalid access token.`);
        return res.status(401).json({ error: "Invalid access token." });
    }
});

// Authentication Middleware
function authenticateToken(req, res, next) {
    const clientIp = req.ip; // Get client IP
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) {
        console.warn(`[${clientIp}] Access token required for /ask endpoint.`);
        return res.status(401).json({ error: "Access token required." });
    }

    if (token !== REQUIRED_ACCESS_TOKEN) {
        console.warn(
            `[${clientIp}] Forbidden: Invalid access token provided for /ask endpoint.`
        );
        return res
            .status(403)
            .json({ error: "Forbidden: Invalid access token." });
    }

    next();
}

/**
 * Handles incoming POST requests to the /ask endpoint.
 * Processes user prompts using the Google GenAI model and returns a response.
 * Now protected by authenticateToken middleware.
 */
app.post("/ask", authenticateToken, async (req, res) => {
    const clientIp = req.ip; // Get client IP

    if (!schoolData) {
        console.error(
            `[${clientIp}] Server error: School data not loaded for /ask request.`
        );
        return res.status(503).json({
            error: "Server is initializing, school data not yet loaded.",
        });
    }

    const userPrompt = req.body.prompt;

    if (!userPrompt || userPrompt.trim() === "") {
        console.warn(`[${clientIp}] Bad request: Prompt cannot be empty.`);
        return res.status(400).json({ error: "Prompt cannot be empty." });
    }

    console.log(`[${clientIp}] User query received: "${userPrompt}"`);

    try {
        const systemInstruction = `You are a school receptionist. If the answer is not in the data, politely state that you do not have that information. Do not make up informatio. Never mention that you have been provided context. Always just give the answer from the given context, as if you were a trained AI model The current date is ${new Date().toDateString()}.`;

        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `CONTEXT:\n${schoolData}\n\nQUESTION:\n${userPrompt}`,
                        },
                    ],
                },
            ],
            generationConfig: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 100,
            },
        });

        let botResponse = "";
        for await (const chunk of responseStream) {
            botResponse += chunk.text;
        }

        console.log(`[${clientIp}] Bot response (raw): "${botResponse}"`);
        res.json({ response: botResponse });
    } catch (error) {
        console.error(
            `[${clientIp}] AI Error for prompt "${userPrompt}":`,
            error
        );
        res.status(500).json({
            error: "Sorry, I encountered an error while processing your request. Please try again.",
        });
    }
});

/**
 * Initializes the server: loads school data and starts listening for requests.
 */
async function initialize() {
    await loadSchoolData();
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        console.log(`Access the application at http://localhost:${port}`);
        console.log(`Please enter your ACCESS_TOKEN to proceed.`);
    });
}

initialize();
