document.addEventListener("DOMContentLoaded", () => {
    const loginContainer = document.getElementById("login-container");
    const accessTokenInput = document.getElementById("access-token-input");
    const loginButton = document.getElementById("login-button");
    const loginErrorMessage = document.getElementById("login-error-message");

    const chatInterface = document.getElementById("chat-interface");
    const userInput = document.getElementById("user-input");
    const sendButton = (document = document.getElementById("send-button"));
    const voiceButton = document.getElementById("voice-button");
    const chatWindow = document.getElementById("chat-window");
    const errorMessage = document.getElementById("error-message");
    const logoutButton = document.getElementById("logout-button");

    let ttsSpeed = 1.3;

    const chatbotPopup = document.getElementById("chatbot-popup");
    const popupHeader = document.getElementById("popup-header");
    const toggleButton = document.getElementById("toggle-button");
    const popupContent = document.getElementById("popup-content");

    let recognition;
    let synth = window.speechSynthesis;
    let indianVoice = null;

    let speakResponseAfterSTT = false;
    let currentBotMessageBubble = null; // To hold the reference to the bot's current bubble (for typing indicator)

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
            // Show typing indicator in a new bubble
            showTypingIndicator();
            userInput.placeholder = "Listening...";
            speakResponseAfterSTT = true;
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
            hideTypingIndicator(true); // Hide and potentially remove the bubble
            voiceButton.textContent = "🎤";
            voiceButton.classList.add("bg-green-500", "hover:bg-green-600");
            voiceButton.classList.remove("bg-red-500", "hover:bg-red-600");
            userInput.placeholder = "Type your message...";
            speakResponseAfterSTT = false;
        };

        recognition.onend = () => {
            // Typing indicator is handled by sendMessage after user input
            voiceButton.textContent = "🎤";
            voiceButton.classList.add("bg-green-500", "hover:bg-green-600");
            voiceButton.classList.remove("bg-red-500", "hover:bg-red-600");
            userInput.placeholder = "Type your message...";
            // speakResponseAfterSTT should already be false if sendMessage was called.
            // If recognition ends without sending a message (e.g., no speech), hide indicator.
            if (userInput.value === "" && currentBotMessageBubble) {
                hideTypingIndicator(true);
            }
        };
    }

    function speakText(text) {
        if (!synth || !indianVoice) {
            console.warn("Speech Synthesis or Indian voice not ready.");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = indianVoice;
        utterance.lang = indianVoice.lang;
        utterance.rate = ttsSpeed;

        utterance.onerror = (event) => {
            console.error("SpeechSynthesisUtterance.onerror", event.error);
        };

        synth.speak(utterance);
    }

    // Modified appendMessage to only add user messages
    function appendMessage(sender, message, isHtml = false) {
        const messageBubble = document.createElement("div");
        messageBubble.classList.add("message-bubble");

        if (sender === "User") {
            messageBubble.classList.add("user-message");
            if (isHtml) {
                messageBubble.innerHTML = message;
            } else {
                messageBubble.textContent = message;
            }
            chatWindow.appendChild(messageBubble);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
        // Bot messages are handled by showTypingIndicator and updateBotMessageBubble
    }

    // New function to show typing indicator inside a new bot bubble
    function showTypingIndicator() {
        if (currentBotMessageBubble) {
            // If an old typing indicator bubble exists, remove it first
            currentBotMessageBubble.remove();
            currentBotMessageBubble = null;
        }

        currentBotMessageBubble = document.createElement("div");
        currentBotMessageBubble.classList.add("message-bubble", "bot-message");
        currentBotMessageBubble.innerHTML = `
            <div class="typing-indicator-bubble">
                <span></span><span></span><span></span>
            </div>
        `;
        chatWindow.appendChild(currentBotMessageBubble);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        sendButton.disabled = true;
        voiceButton.disabled = true;
    }

    // New function to update the bot message bubble with actual content
    function updateBotMessageBubble(message, isHtml = false, speak = false) {
        if (currentBotMessageBubble) {
            if (isHtml) {
                currentBotMessageBubble.innerHTML = message;
            } else {
                currentBotMessageBubble.textContent = message;
            }
            chatWindow.scrollTop = chatWindow.scrollHeight;

            if (speak) {
                const textOnlyMessage = message.replace(/<[^>]*>/g, "");
                speakText(textOnlyMessage);
            }
            currentBotMessageBubble = null; // Clear reference after updating
        } else {
            // Fallback if somehow typing indicator wasn't shown, append as new message
            const messageBubble = document.createElement("div");
            messageBubble.classList.add("message-bubble", "bot-message");
            if (isHtml) {
                messageBubble.innerHTML = message;
            } else {
                messageBubble.textContent = message;
            }
            chatWindow.appendChild(messageBubble);
            chatWindow.scrollTop = chatWindow.scrollHeight;
            if (speak) {
                const textOnlyMessage = message.replace(/<[^>]*>/g, "");
                speakText(textOnlyMessage);
            }
        }
        sendButton.disabled = false;
        voiceButton.disabled = false;
    }

    // New function to hide and optionally remove the typing indicator bubble
    function hideTypingIndicator(removeBubble = false) {
        if (currentBotMessageBubble) {
            if (removeBubble) {
                currentBotMessageBubble.remove();
            } else {
                // If not removing, clear content (though usually it will be replaced)
                currentBotMessageBubble.innerHTML = "";
            }
            currentBotMessageBubble = null;
        }
        sendButton.disabled = false;
        voiceButton.disabled = false;
    }

    async function sendMessage() {
        const prompt = userInput.value.trim();
        const storedAccessToken = localStorage.getItem("accessToken");

        const shouldSpeakThisResponse = speakResponseAfterSTT;

        if (!prompt) {
            return;
        }

        if (!storedAccessToken) {
            errorMessage.textContent = "Not logged in. Please log in to chat.";
            errorMessage.classList.remove("hidden");
            updateBotMessageBubble(
                "Not logged in. Please log in to chat.",
                false,
                false
            );
            return;
        }

        errorMessage.classList.add("hidden");
        appendMessage("User", prompt, false); // Append user message first
        userInput.value = "";

        showTypingIndicator(); // Show typing indicator in a new bot bubble

        speakResponseAfterSTT = false;

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
            updateBotMessageBubble(
                data.response,
                true, // isHtml true for bot responses
                shouldSpeakThisResponse
            );
        } catch (error) {
            console.error("Error sending message:", error);
            errorMessage.textContent =
                error.message || "An unexpected error occurred.";
            errorMessage.classList.remove("hidden");
            updateBotMessageBubble(
                "Sorry, I encountered an error. Please try again.",
                false,
                false
            );
        } finally {
            // Cleanup and enable controls. updateBotMessageBubble already does this.
            userInput.focus();
        }
    }

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
            updateBotMessageBubble(
                // Use updateBotMessageBubble for initial message as well
                "Hello! How can I assist you with SPSMV school information today?",
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

    function showLoginScreen() {
        loginContainer.classList.remove("hidden");
        chatInterface.classList.add("hidden");
        accessTokenInput.focus();
        loginErrorMessage.classList.add("hidden");
        chatWindow.innerHTML = ""; // Clear all messages including any old typing indicator
        currentBotMessageBubble = null; // Clear reference
    }

    function showChatInterface() {
        loginContainer.classList.add("hidden");
        chatInterface.classList.remove("hidden");
        errorMessage.classList.add("hidden");
    }

    function logoutUser(showAuthError = false) {
        localStorage.removeItem("accessToken");
        showLoginScreen();
        if (showAuthError) {
            loginErrorMessage.textContent =
                "Your session expired or token is invalid. Please log in again.";
            loginErrorMessage.classList.remove("hidden");
        }
    }

    let isExpanded = false;

    function toggleChatbotPopup() {
        isExpanded = !isExpanded;
        if (isExpanded) {
            chatbotPopup.classList.add("expanded");
            popupContent.classList.remove("hidden");
            toggleButton.textContent = "-";
            if (localStorage.getItem("accessToken")) {
                userInput.focus();
            } else {
                accessTokenInput.focus();
            }
            // Check if there are *any* messages (not just initial setup)
            if (
                chatWindow.children.length === 0 &&
                localStorage.getItem("accessToken")
            ) {
                updateBotMessageBubble(
                    "Welcome back! How can I assist you with SPSMV school information today?",
                    false,
                    false
                );
            }
        } else {
            chatbotPopup.classList.remove("expanded");
            popupContent.classList.add("hidden");
            toggleButton.textContent = "+";
            if (synth.speaking) {
                synth.cancel();
            }
            if (recognition && recognition.listening) {
                recognition.stop();
            }
            speakResponseAfterSTT = false;
            hideTypingIndicator(true); // Ensure typing indicator is removed when closing
        }
    }

    loginButton.addEventListener("click", login);
    logoutButton.addEventListener("click", () => logoutUser(false));

    accessTokenInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            login();
        }
    });

    sendButton.addEventListener("click", () => {
        sendMessage();
    });

    voiceButton.addEventListener("click", () => {
        if (recognition) {
            if (synth.speaking) {
                synth.cancel();
            }
            speakResponseAfterSTT = true;
            recognition.start();
        }
    });

    userInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    popupHeader.addEventListener("click", toggleChatbotPopup);
    toggleButton.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleChatbotPopup();
    });

    // Initial load state
    const initialToken = localStorage.getItem("accessToken");
    if (initialToken) {
        showChatInterface();
        // Append initial bot message if not already present
        if (chatWindow.children.length === 0) {
            updateBotMessageBubble(
                "Hello! How can I assist you with SPSMV school information today?",
                false,
                false
            );
        }
    } else {
        showLoginScreen();
    }
    chatbotPopup.classList.remove("expanded");
    popupContent.classList.add("hidden");
    toggleButton.textContent = "+";
});
