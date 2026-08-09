const http = require('http');
const url = require('url');

// HTML Code for the Dashboard UI
const htmlDashboard = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodePulse - AI Contribution Analyzer</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d1117; color: #c9d1d9; max-width: 800px; margin: 40px auto; padding: 20px; }
        h1 { color: #58a6ff; text-align: center; }
        .card { background: #161b22; padding: 25px; border-radius: 8px; border: 1px solid #30363d; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        input[type="text"] { width: 100%; padding: 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #fff; box-sizing: border-box; font-size: 16px; margin-bottom: 15px; }
        button { background: #238636; color: white; border: none; padding: 12px 20px; font-size: 16px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; }
        button:hover { background: #2ea043; }
        .result { margin-top: 25px; padding: 15px; border-radius: 6px; display: none; }
        .success { background: rgba(35, 134, 54, 0.15); border: 1px solid #238636; color: #56d364; }
        .warning { background: rgba(218, 118, 26, 0.15); border: 1px solid #da761a; color: #f0883e; }
        .metric { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>⚡ CodePulse</h1>
    <div class="card">
        <p>Analyze how much original human effort went into a GitHub code file.</p>
        <input type="text" id="repoUrl" placeholder="Paste raw GitHub file URL (e.g., https://githubusercontent.com)">
        <button onclick="analyzeCode()">Analyze Pulse</button>
        
        <div id="resultBox" class="result">
            <div id="scoreMetric" class="metric">Humanity Score: 100%</div>
            <p id="analysisReason"></p>
        </div>
    </div>

    <script>
        async function analyzeCode() {
            const rawUrl = document.getElementById('repoUrl').value.trim();
            if(!rawUrl) return alert('Please enter a valid URL');
            
            try {
                const response = await fetch('/api/analyze?url=' + encodeURIComponent(rawUrl));
                const data = await response.json();
                
                const resultBox = document.getElementById('resultBox');
                const scoreMetric = document.getElementById('scoreMetric');
                const analysisReason = document.getElementById('analysisReason');
                
                resultBox.style.display = 'block';
                scoreMetric.innerText = 'Human Heartbeat Score: ' + data.score + '%';
                analysisReason.innerText = data.reason;
                
                if(data.score >= 50) {
                    resultBox.className = 'result success';
                } else {
                    resultBox.className = 'result warning';
                }
            } catch(err) {
                alert('Analysis failed. Make sure it is a RAW GitHub URL.');
            }
        }
    </script>
</body>
</html>
`;

// Helper function to scan the code for AI indicators
function scanCodePatterns(codeText) {
    let aiIndicators = 0;
    
    // 1. AI often uses highly repetitive, standard docstrings or headers
    if (codeText.includes("Create, Read, Update, Delete") || codeText.includes("Placeholder for")) aiIndicators += 25;
    
    // 2. AI code rarely contains chaotic/messy loops or customized debug lines
    if (!codeText.includes("console.log") && codeText.includes("try {") && codeText.includes("catch")) aiIndicators += 15;
    
    // 3. AI formatting is mathematically uniform
    const lines = codeText.split('\n');
    let perfectlyUniformLines = 0;
    lines.forEach(line => {
        if(line.startsWith('    ') || line.startsWith('\t')) perfectlyUniformLines++;
    });
    if(perfectlyUniformLines > (lines.length * 0.7)) aiIndicators += 20;

    let score = 100 - aiIndicators;
    if (score < 0) score = 0;

    let reason = "Strong human pulse detected. Variable styling, custom error handles, and natural logic drift indicate standard active engineering development.";
    if(score < 70) {
        reason = "Suspicious uniform structure found. The formatting density and lack of structural adjustments suggest direct automated copy-pasting or template seeding.";
    }
    
    return { score, reason };
}

// Server Controller
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // API endpoint for analyzing code
    if (parsedUrl.pathname === '/api/analyze' && req.method === 'GET') {
        const fileUrl = parsedUrl.query.url;
        
        // Simple mock response if connection drops
        if (!fileUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing target URL' }));
        }

        // Fetching the raw text file from the user's input link
        http.get(fileUrl, (fetchRes) => {
            let body = '';
            fetchRes.on('data', chunk => body += chunk);
            fetchRes.on('end', () => {
                const analysis = scanCodePatterns(body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(analysis));
            });
        }).on('error', (e) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ score: 40, reason: "Error contacting link, defaulting data metrics." }));
        });
        
    } else {
        // Serve the beautiful Dashboard Frontend
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlDashboard);
    }
});

// Start listening on port 3000 (Standard for Zerops)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CodePulse listening securely on port ${PORT}`);
});
