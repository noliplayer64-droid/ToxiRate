async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");

    aiOutput.innerText = "Processing analysis...";

    try {
        // We include the instructions inside the text prompt for the AI
        const medicalSystemContext = "System Instructions: You are ToxiRate AI, an emergency poison toxicity assessment companion. Focus on triage priority. Question: ";
        const finalPrompt = encodeURIComponent(medicalSystemContext + prompt);

        // A clean, open GET request that public browsers cannot block
        const response = await fetch(`https://pollinations.ai{finalPrompt}?json=false&seed=42`);

        if (!response.ok) {
            throw new Error(`Server status error: ${response.status}`);
        }

        const replyText = await response.text();
        
        if (replyText && replyText.trim().length > 0) {
            aiOutput.innerText = replyText;
        } else {
            aiOutput.innerText = "Error: Received empty response from AI engine.";
        }
        aiInput.value = ""; 
    } catch (error) {
        aiOutput.innerText = "Error: Connection timed out or server busy. Please try again.";
        console.error("Connection failed:", error);
    }
}
