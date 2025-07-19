// app.js - Express.js Server
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const path = require("path"); // Import path module

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000; // Use port from environment or default to 3000

// Initialize Google GenAI with API key
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    // Override res.json to intercept and modify the response before sending
    const originalJson = res.json;
    res.json = function (body) {
        if (
            body &&
            typeof body === "object" &&
            body.response &&
            typeof body.response === "string"
        ) {
            // Check if the content is likely plain text with newlines
            // and not already well-formed HTML (e.g., containing <table>)
            // This is a heuristic; you might need to refine it based on AI output patterns.
            if (
                !body.response.includes("<br>") &&
                !body.response.includes("<table")
            ) {
                // Replace all occurrences of \n with <br>
                body.response = body.response.replace(/\n/g, "<br>");
            }
        }
        originalJson.call(this, body); // Call the original json method to send the response
    };
    next(); // Continue to the next middleware or route handler
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
        // Exit the process if school data cannot be loaded, as it's critical for the app
        console.log(
            "Error: Could not load school information. Please ensure 'school_data.json' exists and is accessible."
        );
        process.exit(1);
    }
}

/**
 * Handles incoming POST requests to the /ask endpoint.
 * Processes user prompts using the Google GenAI model and returns a response.
 */
app.post("/ask", async (req, res) => {
    // Check if school data is loaded before processing requests
    if (!schoolData) {
        return res.status(503).json({
            error: "Server is initializing, school data not yet loaded.",
        });
    }

    const userPrompt = req.body.prompt; // Get the prompt from the request body

    // Validate if a prompt was provided
    if (!userPrompt || userPrompt.trim() === "") {
        return res.status(400).json({ error: "Prompt cannot be empty." });
    }

    console.log(`User query received: "${userPrompt}"`);

    try {
        // Define the system instruction for the AI model.  Key change here.
        const systemInstruction = `You are a helpful school parent assistant. Your role is to answer questions from parents based ONLY on the provided JSON data. If the user is asking about fees, use HTML tables to display fee structures for different classes and other fee information. Use <b></b> for bold text. Use <br> for newlines. Use HTML table tags (<table>, <tr>, <td>, <th>). If the answer is not in the data, politely state that you do not have that information. Do not make up information. Always ask for the context from the user. The current date is ${new Date().toDateString()}. Do not use markdown. Always use HTML tags.`;

        // Generate content using the Google GenAI model
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash", // Using gemini-2.5-flash as specified in the original code
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
                maxOutputTokens: 75, // Increased tokens to account for the table generation. Adjust if needed.
            },
        });

        let botResponse = "";
        // Stream the response chunks and concatenate them
        for await (const chunk of responseStream) {
            botResponse += chunk.text;
        }

        console.log(`Bot response (raw): "${botResponse}"`); // Log raw response before middleware
        // Send the AI's response back to the client as JSON
        res.json({ response: botResponse }); // The middleware will now process this before sending
    } catch (error) {
        console.error("AI Error:", error);
        // Send an error response to the client
        res.status(500).json({
            error: "Sorry, I encountered an error while processing your request. Please try again.",
        });
    }
});

/**
 * Initializes the server: loads school data and starts listening for requests.
 */
async function initialize() {
    await loadSchoolData(); // Load school data first
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        console.log(`Access the application at http://localhost:${port}`);
    });
}

initialize(); // Call the initialize function to start the server
