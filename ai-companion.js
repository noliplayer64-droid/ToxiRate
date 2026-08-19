// Paste your GitHub Token (github_pat_...) inside the quotes below
const GITHUB_AI_TOKEN = "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"

async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");
    if (GITHUB_AI_TOKEN.includes("PASTE_YOUR")) return alert("Please configure your GitHub Token inside ai-companion.js.");

    aiOutput.innerText = "Processing analysis...";

    try {
        // Fetches from GitHub's AI endpoint proxy using your secure token
        const response = await fetch("https://azure.com", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GITHUB_AI_TOKEN}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Pulls the official OpenAI model via GitHub
                messages: [
                    { 
                        role: "system", 
                        content: "You are an AI medical companion built into ToxiRate, an emergency poison toxicity assessment application. Focus answers on triage priority and patient safety metrics." 
                    },
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            aiOutput.innerText = data.choices[0].message.content;
        } else {
            aiOutput.innerText = "Error: Check token or daily rate limits.";
        }
        aiInput.value = ""; 
    } catch (error) {
        aiOutput.innerText = "Error: Could not connect to the AI engine.";
        console.error("Connection failed:", error);
    }
}
