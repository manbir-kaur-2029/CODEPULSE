const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// The core algorithm inspecting code strings for raw AI generation indicators
function checkHumanContribution(codeText, commitCount) {
    let score = 100;
    const flags = [];

    // Indicator 1: Looking for leftover conversational AI boilerplate text fragments
    if (/as an ai|here is the code|hope this helps|certainly!/i.test(codeText)) {
        score -= 40;
        flags.push("Leftover conversational AI prompts detected in comments.");
    }

    // Indicator 2: Looking for abnormal comment ratios (AI heavily over-comments simple things)
    const comments = codeText.match(/\/\*[\s\S]*?\*\/|\/\/.*/g) || [];
    if (comments.length > 0 && codeText.length / comments.length < 6) {
        score -= 20;
        flags.push("Irregular structural comment density (typical of AI formatting).");
    }

    // Indicator 3: Looking at human work cadence (real software is built step-by-step)
    if (parseInt(commitCount) <= 2) {
        score -= 25;
        flags.push("Critically low commit count (indicates a single copy-paste block).");
    }

    // Lock scores safely between 0 and 100
    score = Math.max(0, Math.min(100, score));

    let verdict = "Highly Authentic Human Work";
    if (score < 50) verdict = "Flagged: Pure AI Generation Suspected";
    else if (score < 80) verdict = "Mixed: AI Assisted with Human Structure";

    return { score, verdict, flags };
}

// API Endpoint for Hackathon Organizers
app.post('/api/audit', (req, res) => {
    const { repoUrl, codeSample, commits } = req.body;
    
    if (!repoUrl || !codeSample) {
        return res.status(400).json({ error: 'Please enter both a repository link and a code snippet.' });
    }

    const auditResults = checkHumanContribution(codeSample, commits || 1);
    res.json({
        repository: repoUrl,
        checkedAt: new Date().toLocaleTimeString(),
        ...auditResults
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CodePulse backend engine successfully online on port ${PORT}`));
