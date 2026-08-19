function askToxiAI() {
    const aiInput = document.getElementById('aiInput');
    const aiOutput = document.getElementById('aiOutput');
    const prompt = aiInput.value.toLowerCase().trim();
    
    if (!prompt) return alert("Please type your triage question.");

    aiOutput.innerText = "Analyzing local metrics matrix...";

    // Simulated Triage Algorithm
    if (prompt.includes("cow") || prompt.includes("withdrawal") || prompt.includes("opioid")) {
        aiOutput.innerHTML = `
            <strong>ToxiRate Triage Rules:</strong><br>
            • Evaluate Clinical Opiate Withdrawal Scale (COWS) immediately.<br>
            • Check for mild (5-12), moderate (13-24), or severe (36+) symptoms.<br>
            • <em>Action:</em> Monitor vital signs and prioritize fluid balancing management.
        `;
    } else if (prompt.includes("hlt") || prompt.includes("liver") || prompt.includes("acetaminophen")) {
        aiOutput.innerHTML = `
            <strong>ToxiRate Triage Rules:</strong><br>
            • Assess Hepatic Injury Threshold Limits (HLT).<br>
            • Chart timeline hours post-ingestion via the Rumack-Matthew Nomogram.<br>
            • <em>Action:</em> Alert medical staff if threshold calculation rules indicate toxic exposure.
        `;
    } else if (prompt.includes("help") || prompt.includes("emergency") || prompt.includes("poison")) {
        aiOutput.innerHTML = `
            <strong>ToxiRate Alert:</strong><br>
            • Confirm baseline vitals (Airway, Breathing, Circulation).<br>
            • Route immediately to local Poison Control or Emergency Response.<br>
            • Keep calculation metrics ready for medical personnel handoff.
        `;
    } else {
        aiOutput.innerHTML = `
            <strong>Analysis Complete:</strong><br>
            "${aiInput.value}" received. For accurate clinical tracking, use the specific ToxiRate HLT and COW slider inputs provided in the dashboard.
        `;
    }

    aiInput.value = ""; 
}
