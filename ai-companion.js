async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");

    aiOutput.innerText = "Processing analysis...";

    try {
        // We use a free, tokenless AI endpoint designed for browser applications
        const response = await fetch(`https://pollinations.ai`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    { 
                        role: "system", 
                        content: "You are an AI medical companion built into ToxiRate, an emergency poison toxicity assessment application. Focus answers on triage priority and safety metrics." 
                    },
                    { role: "user", content: prompt }
                ],
                seed: 42,
                jsonMode: false
            })
        });

        const replyText = await response.text();
        
        if (replyText) {
            aiOutput.innerText = replyText;
        } else {
            aiOutput.innerText = "Error: Received empty response from AI engine.";
        }
        aiInput.value = ""; 
    } catch (error) {
        aiOutput.innerText = "Error: Could not connect to the open AI network.";
        console.error("Connection failed:", error);
    }
}
