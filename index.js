const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const app = express();

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
});
app.use(limiter);

// Security header only — no redirect.
// Zerops terminates TLS at the edge; a redirect here can loop or block
// health checks and cause 502s.
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Serve the frontend
app.use(express.static('public'));

// Main route — matches the frontend's fetch('/api/audit')
app.post('/api/audit', (req, res) => {
  try {
    const { repoUrl, codeSample, commits } = req.body;

    if (typeof repoUrl !== 'string' || typeof codeSample !== 'string') {
      return res.status(400).json({ error: 'Invalid input types.' });
    }

    const commitCount = parseInt(commits, 10);
    if (isNaN(commitCount) || commitCount < 0) {
      return res.status(400).json({ error: 'Invalid commit count.' });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (codeSample.length > MAX_SIZE) {
      return res.status(413).json({ error: 'Input too large.' });
    }

    const result = runChecks(repoUrl.trim(), codeSample, commitCount);
    res.json(result);
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).json({ error: 'Server error while running diagnostic.' });
  }
});

// Function: runChecks
// NOTE: this is a heuristic, not a forensic tool. It scores signals that
// loosely correlate with iterative human editing vs. single-pass generation.
function runChecks(repoUrl, codeText, commitCount) {
  const lines = codeText.split(/\r?\n/);
  const totalLines = lines.length;

  const commentRegex = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  const comments = codeText.match(commentRegex) || [];
  const commentCount = comments.length;
  const density = totalLines === 0 ? 0 : commentCount / totalLines;

  // Rough "line length variance" — real edited code tends to be uneven;
  // generated code in one pass tends to be suspiciously uniform.
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const avgLen = nonEmptyLines.length
    ? nonEmptyLines.reduce((sum, l) => sum + l.length, 0) / nonEmptyLines.length
    : 0;
  const variance = nonEmptyLines.length
    ? nonEmptyLines.reduce((sum, l) => sum + Math.pow(l.length - avgLen, 2), 0) / nonEmptyLines.length
    : 0;
  const stdDev = Math.sqrt(variance);

  let score = 50;
  const checks = [];

  // Commit history check
  if (commitCount <= 1) {
    score -= 20;
    checks.push({ hit: true, delta: -20, label: 'Single-commit history', detail: `Only ${commitCount} commit(s) found — no visible iteration.` });
  } else if (commitCount < 5) {
    score -= 8;
    checks.push({ hit: true, delta: -8, label: 'Sparse commit history', detail: `${commitCount} commits — limited iteration trail.` });
  } else {
    score += 15;
    checks.push({ hit: true, delta: 15, label: 'Healthy commit history', detail: `${commitCount} commits suggest incremental work.` });
  }

  // Comment density check
  if (density > 0.35) {
    score -= 15;
    checks.push({ hit: true, delta: -15, label: 'Unusually high comment density', detail: `${(density * 100).toFixed(1)}% of lines are comments — often a generation artifact.` });
  } else if (density < 0.02 && totalLines > 30) {
    score -= 5;
    checks.push({ hit: true, delta: -5, label: 'Almost no comments', detail: 'Long sample with virtually no explanatory comments.' });
  } else {
    score += 5;
    checks.push({ hit: true, delta: 5, label: 'Reasonable comment density', detail: `${(density * 100).toFixed(1)}% of lines are comments.` });
  }

  // Line-length uniformity check
  if (stdDev < 8 && nonEmptyLines.length > 20) {
    score -= 10;
    checks.push({ hit: true, delta: -10, label: 'Uniform formatting', detail: 'Line lengths are unusually consistent across the sample.' });
  } else {
    score += 5;
    checks.push({ hit: true, delta: 5, label: 'Natural formatting variance', detail: 'Line lengths vary the way hand-edited code typically does.' });
  }

  // Sample size sanity check
  if (totalLines < 15) {
    score -= 5;
    checks.push({ hit: false, delta: 0, label: 'Small sample size', detail: `Only ${totalLines} lines submitted — low confidence reading.` });
  } else {
    checks.push({ hit: false, delta: 0, label: 'Sample size adequate', detail: `${totalLines} lines analyzed.` });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict;
  if (score < 50) verdict = 'Likely AI-generated';
  else if (score < 80) verdict = 'Mixed signal';
  else verdict = 'Likely human-driven';

  return {
    score,
    verdict,
    repository: repoUrl || '(no repository link provided)',
    checkedAt: new Date().toISOString(),
    checks,
  };
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
