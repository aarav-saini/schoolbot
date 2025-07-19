// public/script.js - Frontend Logic
document.addEventListener("DOMContentLoaded", () => {
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const voiceButton = document.getElementById("voice-button"); // Get the new voice button
    const chatWindow = document.getElementById("chat-window");
    const loadingIndicator = document.getElementById("loading-indicator");
    const errorMessage = document.getElementById("error-message");

    let recognition; // Variable for SpeechRecognition
    let synth = window.speechSynthesis; // Variable for SpeechSynthesis
    let indianVoice = null; // To store our chosen Indian voice

    // Function to set the Indian voice
    function setIndianVoice() {
        // Get voices after they are loaded
        const voices = synth.getVoices();
        // Look for an English (India) voice. Common language codes: 'en-IN', 'en_IN'
        // Some browsers might just offer a generic 'en' voice with an Indian accent.
        indianVoice = voices.find(
            (voice) =>
                voice.lang === "en-IN" ||
                voice.lang.startsWith("en-IN") ||
                (voice.lang.startsWith("en-") && voice.name.includes("Indian"))
        );

        if (!indianVoice) {
            console.warn(
                "Indian English voice not found. Falling back to default English voice."
            );
            // Fallback to a generic English voice if Indian one isn't found
            indianVoice = voices.find(
                (voice) =>
                    voice.lang === "en-US" || voice.lang.startsWith("en-")
            );
        }

        if (!indianVoice && voices.length > 0) {
            // If no specific English voice, just pick the first available voice
            indianVoice = voices[0];
        }
    }

    // Event listener for when voices are loaded/changed
    // This is crucial because voices might not be immediately available
    synth.onvoiceschanged = setIndianVoice;

    // Call setIndianVoice once on load, in case voices are already loaded
    // And also ensure it's called after the 'onvoiceschanged' event fires.
    if (synth.getVoices().length > 0) {
        setIndianVoice();
    }

    // Check for Web Speech API browser support for STT
    if (
        !("webkitSpeechRecognition" in window) &&
        !("SpeechRecognition" in window)
    ) {
        console.warn(
            "Web Speech API Speech Recognition not supported in this browser."
        );
        voiceButton.style.display = "none"; // Hide the button if not supported
    } else {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Recognizes a single utterance
        recognition.interimResults = false; // Only returns final results
        recognition.lang = "en-IN"; // Set STT language to Indian English

        recognition.onstart = () => {
            voiceButton.textContent = "🔴 Speaking...";
            voiceButton.classList.add("bg-red-500", "hover:bg-red-600");
            voiceButton.classList.remove("bg-green-500", "hover:bg-green-600");
            loadingIndicator.classList.remove("hidden");
            userInput.placeholder = "Listening...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript; // Put the spoken text into the input field
            sendMessage(); // Send the message automatically
            userInput.placeholder = "Type your message...";
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            errorMessage.textContent = `Speech recognition error: ${event.error}`;
            errorMessage.classList.remove("hidden");
            loadingIndicator.classList.add("hidden");
            voiceButton.textContent = "🎤";
            voiceButton.classList.add("bg-green-500", "hover:bg-green-600");
            voiceButton.classList.remove("bg-red-500", "hover:bg-red-600");
            userInput.placeholder = "Type your message...";
        };

        recognition.onend = () => {
            loadingIndicator.classList.add("hidden");
            voiceButton.textContent = "🎤";
            voiceButton.classList.add("bg-green-500", "hover:bg-green-600");
            voiceButton.classList.remove("bg-red-500", "hover:bg-red-600");
            userInput.placeholder = "Type your message...";
        };
    }

    // TTS Function
    function speakText(text) {
        if (!synth || !indianVoice) {
            // Check if synth and a voice are available
            console.warn("Speech Synthesis or Indian voice not ready.");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = indianVoice; // Assign the found Indian voice
        utterance.lang = indianVoice.lang; // Set lang based on the chosen voice

        utterance.onerror = (event) => {
            console.error("SpeechSynthesisUtterance.onerror", event.error);
        };

        synth.speak(utterance);
    }

    function appendMessage(
        sender,
        message,
        senderColor,
        isHtml = false,
        speak = false
    ) {
        const messageWrapper = document.createElement("div");
        messageWrapper.classList.add("mb-2");

        const senderSpan = document.createElement("span");
        senderSpan.classList.add("font-semibold", senderColor);
        senderSpan.textContent = `${sender}: `;

        messageWrapper.appendChild(senderSpan);

        if (isHtml) {
            const messageContent = document.createElement("div");
            messageContent.innerHTML = message;
            messageContent.style.whiteSpace = "pre-wrap";
            messageContent.classList.add("font-monospace");
            messageWrapper.appendChild(messageContent);
        } else {
            const textNode = document.createTextNode(message);
            messageWrapper.appendChild(textNode);
        }

        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        if (speak && sender === "Bot") {
            // Only speak bot responses
            // Remove HTML tags for speech synthesis
            const textOnlyMessage = message.replace(/<[^>]*>/g, "");
            speakText(textOnlyMessage);
        }
    }

    async function sendMessage() {
        const prompt = userInput.value.trim();

        if (!prompt) {
            return;
        }

        errorMessage.classList.add("hidden");

        appendMessage("User", prompt, "text-gray-800", false);

        userInput.value = "";

        loadingIndicator.classList.remove("hidden");
        sendButton.disabled = true;
        voiceButton.disabled = true; // Disable voice during bot processing

        try {
            const response = await fetch("/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt: prompt }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json();
            // Pass true to `speak` to activate TTS for bot responses
            appendMessage("Bot", data.response, "text-blue-600", true, true);
        } catch (error) {
            console.error("Error sending message:", error);
            errorMessage.textContent =
                error.message || "An unexpected error occurred.";
            errorMessage.classList.remove("hidden");
            appendMessage(
                "Bot",
                "Sorry, I encountered an error. Please try again.",
                "text-red-500",
                false,
                true // Also speak error messages
            );
        } finally {
            loadingIndicator.classList.add("hidden");
            sendButton.disabled = false;
            voiceButton.disabled = false; // Re-enable voice button
            userInput.focus();
        }
    }

    sendButton.addEventListener("click", sendMessage);

    // Event listener for the new voice button
    voiceButton.addEventListener("click", () => {
        if (recognition) {
            // Stop any ongoing speech synthesis if the user wants to speak
            if (synth.speaking) {
                synth.cancel();
            }
            recognition.start(); // Start listening
        }
    });

    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    userInput.focus();

    // Initial greeting, spoken aloud
    appendMessage(
        "Bot",
        "Hello! How can I assist you with SPSMV school information today?",
        "text-blue-600",
        false,
        false
    );
});
