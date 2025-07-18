const { GoogleGenAI } = require("@google/genai");
const readline = require("readline");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const say = require("say");

dotenv.config();

let schoolData;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function loadSchoolData() {
    try {
        const data = await fs.readFile("school_data.json", "utf8");
        schoolData = data;
        console.log("School data loaded successfully.");
    } catch (error) {
        console.error("Failed to load school data:", error);
        console.log(
            "Error: Could not load school information. Please try again later."
        );
        process.exit(1);
    }
}

async function handlePrompt(userPrompt) {
    if (!schoolData) {
        console.log("School data is not loaded. Cannot process request.");
        return;
    }

    const trimmedPrompt = userPrompt.trim();
    if (!trimmedPrompt) {
        askQuestion();
        return;
    }

    console.log(`User: ${trimmedPrompt}`);
    console.log("Bot: Thinking...");

    try {
        const systemInstruction = `You are a helpful school parent assistant. Your role is to answer questions from parents based ONLY on the provided JSON data. Be friendly and concise. If the answer is not in the data, politely state that you do not have that information. Do not make up information. The current date is ${new Date().toDateString()}.`;

        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `CONTEXT:\n${schoolData}\n\nQUESTION:\n${trimmedPrompt}`,
                        },
                    ],
                },
            ],
            config: {
                systemInstruction: systemInstruction,
            },
        });

        let botResponse = "";
        for await (const chunk of responseStream) {
            botResponse += chunk.text;
        }
        console.log(`Bot: ${botResponse}`);
        say.speak(botResponse, "Rishi", 1.2, (err) => {
            if (err) {
                console.error("Error speaking:", err);
            }
        });
    } catch (error) {
        console.error("AI Error:", error);
        console.log("Bot: Sorry, I encountered an error. Please try again.");
    } finally {
        askQuestion();
    }
}

function askQuestion() {
    rl.question(">", handlePrompt);
}

async function initialize() {
    await loadSchoolData();
    console.log(
        `|> Welcome to SPSMV's School Assistant.\n|> What can I do for you today?`
    );
    askQuestion();
}

initialize();

rl.on("close", () => {
    console.log("\nExiting school assistant. Goodbye!");
    process.exit(0);
});
