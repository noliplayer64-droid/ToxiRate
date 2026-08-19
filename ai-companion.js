async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");

    aiOutput.innerText = "Processing medical analysis...";

    try {
        // Direct format that works perfectly inside browser code without blocks
        const systemText = "You are ToxiRate AI, an emergency poison toxicity assessment companion. Focus on triage priority. Question: ";
        
        const response = await fetch("https://pollinations.ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    { role: "user", content: systemText + prompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned code: ${response.status}`);
        }

        const replyText = await response.text();
        
        if (replyText && replyText.trim().length > 0) {
            // Displays the answer directly in your website's output box
            aiOutput.innerText = replyText;
        } else {
            aiOutput.innerText = "Error: Received empty response from AI engine.";
        }
        aiInput.value = ""; 
    } catch (error) {
        // If strict browser security stops the direct link, use this fallback format
        aiOutput.innerText = "Browser block detected. Trying fallback mode...";
        
        const backupUrl = `https://pollinations.ai${encodeURIComponent(prompt)}?json=false`;
        window.location.href = backupUrl; // Navigates the current tab directly to the answer safely
    }
}
