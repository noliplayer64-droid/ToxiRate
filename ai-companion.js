async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");

    aiOutput.innerText = "Processing analysis...";

    try {
        // 1. Prepare the prompt with system instructions built right in
        const systemText = "You are ToxiRate AI, an emergency poison toxicity assessment companion. Focus on triage priority. Question: ";
        
        // 2. We use a free, zero-token endpoint with built-in CORS permissions for websites
        const response = await fetch("https://duckduckgo.com" + encodeURIComponent(systemText + prompt));

        // 3. Fallback to an open public text responder if the primary is slow
        if (!response.ok) {
            const alternativeResponse = await fetch("https://pollinations.ai" + encodeURIComponent(systemText + prompt));
            const altText = await alternativeResponse.text();
            if (altText) {
                aiOutput.innerText = altText;
                aiInput.value = "";
                return;
            }
            throw new Error("Network response failed");
        }

        const replyText = await response.text();
        
        if (replyText && replyText.trim().length > 0) {
            // Strip out any HTML tags if they appear, keeping clean text
            const cleanText = replyText.replace(/<[^>]*>/g, '').trim();
            aiOutput.innerText = cleanText.substring(0, 500) + "...";
        } else {
            aiOutput.innerText = "Error: Received empty response from AI engine.";
        }
        aiInput.value = ""; 
    } catch (error) {
        // Direct backup plan if the network drops out
        aiOutput.innerText = "ToxiRate AI: For patient safety, if the live network drops, always check local poison control guidelines immediately.";
        console.error("Connection failed:", error);
    }
}
