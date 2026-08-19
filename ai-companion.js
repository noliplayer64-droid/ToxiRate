async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");

    aiOutput.innerText = "Processing analysis...";

    try {
        // System context + your prompt combined
        const systemText = "You are ToxiRate AI, an emergency poison toxicity assessment companion. Focus on triage priority. Question: ";
        const cleanMessage = encodeURIComponent(systemText + prompt);

        // Target URL
        const targetUrl = `https://pollinations.ai{cleanMessage}?json=false&seed=42`;
        
        // WE USE ALLORIGINS TO FORCE THE BROWSER TO ALLOW THE CONNECTION
        const secureProxyUrl = `https://allorigins.win{encodeURIComponent(targetUrl)}`;

        const response = await fetch(secureProxyUrl);

        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }

        const replyText = await response.text();
        
        if (replyText && replyText.trim().length > 0) {
            aiOutput.innerText = replyText;
        } else {
            aiOutput.innerText = "Error: Received empty response from AI engine.";
        }
        aiInput.value = ""; 
    } catch (error) {
        aiOutput.innerText = "Error: Connection timed out or proxy busy. Please try again.";
        console.error("Connection failed:", error);
    }
}

