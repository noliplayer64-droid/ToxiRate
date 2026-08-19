// Paste your GitHub Classic Token (ghp_...) inside the quotes below
const GITHUB_AI_TOKEN = "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";

async function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.trim();
    
    if (!prompt) return alert("Please enter a question for the AI assistant.");
    if (GITHUB_AI_TOKEN.includes("PASTE_YOUR")) return alert("Please configure your GitHub Token inside ai-companion.js.");

    aiOutput.innerText = "Processing analysis...";

    try {
        // We wrap the URL in corsproxy.io to stop the browser from blocking it
        const targetUrl = "https://azure.com";
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);

        const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GITHUB_AI_TOKEN}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Calls OpenAI's model safely
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
        } else if (data.error) {
            aiOutput.innerText = "API Error: " + data.error.message;
        } else {
            aiOutput.innerText = "Error: Check token or daily rate limits.";
        }
        aiInput.value = ""; 
    } catch (error) {
        aiOutput.innerText = "Error: Could not connect to the AI engine.";
        console.error("Connection failed:", error);
    }
}
