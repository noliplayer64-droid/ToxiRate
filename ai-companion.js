/* =========================================
   ToxiRate AI Companion
   ========================================= */

(() => {
  "use strict";

  /*
   * IMPORTANT:
   * Replace this with the URL of your backend after you deploy it.
   *
   * Example:
   * https://toxirate-ai-api.onrender.com/api/chat
   */

  const API_URL = "https://YOUR-BACKEND-URL.com/api/chat";

  const chat = document.getElementById("toxirate-ai-chat");
  const form = document.getElementById("toxirate-ai-form");
  const input = document.getElementById("toxirate-ai-input");
  const sendButton = document.getElementById("toxirate-ai-send");

  const speciesElement = document.getElementById("ai-species");
  const hltElement = document.getElementById("ai-hlt");
  const cowElement = document.getElementById("ai-cow");
  const vrrElement = document.getElementById("ai-vrr");

  if (!chat || !form || !input) {
    console.error("ToxiRate AI Companion: required HTML elements not found.");
    return;
  }

  let conversation = [];

  /*
   * Current information from the ToxiRate calculator.
   */
  let toxirateContext = {
    species: null,
    hlt: null,
    cow: null,
    vrr: null
  };

  /*
   * Allows your existing ToxiRate JavaScript to update
   * the information the AI sees.
   *
   * Example:
   *
   * window.ToxiRateAI.setContext({
   *   species: "Redback spider",
   *   hlt: 5,
   *   cow: 60,
   *   vrr: 7
   * });
   */
  window.ToxiRateAI = {

    setContext(context = {}) {

      toxirateContext = {
        species: context.species ?? null,
        hlt: context.hlt ?? null,
        cow: context.cow ?? null,
        vrr: context.vrr ?? null
      };

      speciesElement.textContent =
        toxirateContext.species || "Not selected";

      hltElement.textContent =
        toxirateContext.hlt ?? "—";

      cowElement.textContent =
        toxirateContext.cow ?? "—";

      vrrElement.textContent =
        toxirateContext.vrr ?? "—";
    },

    clearContext() {
      this.setContext({});
    }
  };

  /*
   * Add a message to the chat window.
   */
  function addMessage(role, text) {

    const wrapper = document.createElement("div");
    wrapper.className =
      `toxirate-ai-message ${role === "user" ? "user" : "ai"}`;

    const label = document.createElement("div");
    label.className = "toxirate-ai-message-label";
    label.textContent =
      role === "user" ? "You" : "ToxiRate AI";

    const bubble = document.createElement("div");
    bubble.className = "toxirate-ai-bubble";

    // textContent prevents returned AI text from becoming HTML.
    bubble.textContent = text;

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);

    chat.appendChild(wrapper);

    chat.scrollTop = chat.scrollHeight;

    return wrapper;
  }

  /*
   * Loading indicator.
   */
  function addLoadingMessage() {

    const wrapper = document.createElement("div");
    wrapper.className = "toxirate-ai-message ai";

    const label = document.createElement("div");
    label.className = "toxirate-ai-message-label";
    label.textContent = "ToxiRate AI";

    const bubble = document.createElement("div");
    bubble.className =
      "toxirate-ai-bubble toxirate-ai-loading";

    bubble.textContent = "Thinking";

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);

    chat.appendChild(wrapper);

    chat.scrollTop = chat.scrollHeight;

    return wrapper;
  }

  /*
   * Send a question.
   */
  async function askAI(question) {

    question = String(question || "").trim();

    if (!question) {
      return;
    }

    if (question.length > 4000) {
      addMessage(
        "ai",
        "Please keep your message under 4,000 characters."
      );
      return;
    }

    addMessage("user", question);

    conversation.push({
      role: "user",
      content: question
    });

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;

    const loading = addLoadingMessage();

    try {

      const response = await fetch(API_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          message: question,

          /*
           * Only send the recent conversation.
           * This keeps requests smaller and limits accidental
           * accumulation of personal information.
           */
          history: conversation.slice(-10),

          toxirate: toxirateContext
        })
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "The AI service could not process the request."
        );
      }

      loading.remove();

      const answer =
        data.answer ||
        "I wasn't able to generate a response.";

      addMessage("ai", answer);

      conversation.push({
        role: "assistant",
        content: answer
      });

    } catch (error) {

      console.error("ToxiRate AI error:", error);

      loading.remove();

      addMessage(
        "ai",
        "I couldn't connect to the AI service. " +
        "Please check your internet connection and try again. " +
        "If this is a real medical emergency, do not wait for the AI — " +
        "contact emergency medical help."
      );

    } finally {

      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  /*
   * Normal form submission.
   */
  form.addEventListener("submit", event => {

    event.preventDefault();

    askAI(input.value);
  });

  /*
   * Quick question buttons.
   */
  document
    .querySelectorAll("[data-ai-question]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const question =
          button.getAttribute("data-ai-question");

        input.value = question;

        askAI(question);
      });
    });

})();
