// public/script.js - Frontend Logic
document.addEventListener("DOMContentLoaded", () => {
    const loginContainer = document.getElementById("login-container");
    const accessTokenInput = document.getElementById("access-token-input");
    const loginButton = document.getElementById("login-button");
    const loginErrorMessage = document.getElementById("login-error-message");

    const chatInterface = document.getElementById("chat-interface");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const voiceButton = document.getElementById("voice-button");
    const chatWindow = document.getElementById("chat-window");
    const loadingIndicator = document.getElementById("loading-indicator");
    const errorMessage = document.getElementById("error-message");
    const logoutButton = document.getElementById("logout-button");

    // !!! NEW: TTS Speed Elements !!!
    const ttsSpeedSlider = document.getElementById("tts-speed-slider");
    const ttsSpeedValueSpan = document.getElementById("tts-speed-value");
    let ttsSpeed = parseFloat(ttsSpeedSlider.value); // Initialize with slider's default value

    let recognition; // Variable for SpeechRecognition
    let synth = window.speechSynthesis; // Variable for SpeechSynthesis
    let indianVoice = null; // To store our chosen Indian voice

    // Function to set the Indian voice
    function setIndianVoice() {
        const voices = synth.getVoices();
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
            indianVoice = voices.find(
                (voice) =>
                    voice.lang === "en-US" || voice.lang.startsWith("en-")
            );
        }

        if (!indianVoice && voices.length > 0) {
            indianVoice = voices[0];
        }
    }

    synth.onvoiceschanged = setIndianVoice;
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
        voiceButton.style.display = "none";
    } else {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-IN";

        recognition.onstart = () => {
            voiceButton.textContent = "🔴 Speaking...";
            voiceButton.classList.add("bg-red-500", "hover:bg-red-600");
            voiceButton.classList.remove("bg-green-500", "hover:bg-green-600");
            loadingIndicator.classList.remove("hidden");
            userInput.placeholder = "Listening...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            sendMessage();
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
            console.warn("Speech Synthesis or Indian voice not ready.");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = indianVoice;
        utterance.lang = indianVoice.lang;
        utterance.rate = ttsSpeed; // !!! NEW: Apply TTS speed !!!

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
            messageContent.style.fontFamily = "monospace";
            messageContent.classList.add("font-monospace");
            messageWrapper.appendChild(messageContent);
        } else {
            const textNode = document.createTextNode(message);
            messageWrapper.appendChild(textNode);
        }

        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        if (speak && sender === "Bot") {
            const textOnlyMessage = message.replace(/<[^>]*>/g, "");
            speakText(textOnlyMessage);
        }
    }

    async function sendMessage() {
        const prompt = userInput.value.trim();
        const storedAccessToken = localStorage.getItem("accessToken");

        if (!prompt) {
            return;
        }

        if (!storedAccessToken) {
            errorMessage.textContent = "Not logged in. Please log in to chat.";
            errorMessage.classList.remove("hidden");
            return;
        }

        errorMessage.classList.add("hidden");
        appendMessage("User", prompt, "text-gray-800", false);
        userInput.value = "";
        loadingIndicator.classList.remove("hidden");
        sendButton.disabled = true;
        voiceButton.disabled = true;

        try {
            const response = await fetch("/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${storedAccessToken}`,
                },
                body: JSON.stringify({ prompt: prompt }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401 || response.status === 403) {
                    logoutUser(true);
                    throw new Error(
                        "Authentication failed. Please log in again."
                    );
                }
                throw new Error(
                    errorData.error || `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json();
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
                true
            );
        } finally {
            loadingIndicator.classList.add("hidden");
            sendButton.disabled = false;
            voiceButton.disabled = false;
            userInput.focus();
        }
    }

    // Login Function
    async function login() {
        const accessToken = accessTokenInput.value.trim();
        loginErrorMessage.classList.add("hidden");

        if (!accessToken) {
            loginErrorMessage.textContent = "Please enter an access token.";
            loginErrorMessage.classList.remove("hidden");
            return;
        }

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ accessToken: accessToken }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error ||
                        `Login failed with status: ${response.status}`
                );
            }

            localStorage.setItem("accessToken", accessToken);
            showChatInterface();
            appendMessage(
                "Bot",
                "Hello! How can I assist you with SPSMV school information today?",
                "text-blue-600",
                false,
                false
            );
            userInput.focus();
        } catch (error) {
            console.error("Login error:", error);
            loginErrorMessage.textContent = error.message;
            loginErrorMessage.classList.remove("hidden");
        }
    }

    // UI Visibility Functions
    function showLoginScreen() {
        loginContainer.classList.remove("hidden");
        chatInterface.classList.add("hidden");
        accessTokenInput.focus();
        loginErrorMessage.classList.add("hidden");
        chatWindow.innerHTML = "";
    }

    function showChatInterface() {
        loginContainer.classList.add("hidden");
        chatInterface.classList.remove("hidden");
        errorMessage.classList.add("hidden");
    }

    // Logout Function
    function logoutUser(showAuthError = false) {
        localStorage.removeItem("accessToken");
        showLoginScreen();
        if (showAuthError) {
            loginErrorMessage.textContent =
                "Your session expired or token is invalid. Please log in again.";
            loginErrorMessage.classList.remove("hidden");
        }
    }

    // Event Listeners
    loginButton.addEventListener("click", login);
    logoutButton.addEventListener("click", () => logoutUser(false));

    accessTokenInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            login();
        }
    });

    sendButton.addEventListener("click", sendMessage);

    voiceButton.addEventListener("click", () => {
        if (recognition) {
            if (synth.speaking) {
                synth.cancel();
            }
            recognition.start();
        }
    });

    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    // !!! NEW: TTS Speed Slider Event Listener !!!
    ttsSpeedSlider.addEventListener("input", (event) => {
        ttsSpeed = parseFloat(event.target.value);
        ttsSpeedValueSpan.textContent = `${ttsSpeed.toFixed(1)}x`; // Update display
    });

    // On page load, check if already logged in
    const initialToken = localStorage.getItem("accessToken");
    if (initialToken) {
        showChatInterface();
        appendMessage(
            "Bot",
            "Welcome back! How can I assist you with SPSMV school information today?",
            "text-blue-600",
            false,
            false
        );
        userInput.focus();
    } else {
        showLoginScreen();
    }
});
