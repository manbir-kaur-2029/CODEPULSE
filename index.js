const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();

app.use(compression());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// Here's the Detection tool presented-
// Each check returns { label, detail, delta, hit } where delta is the
// score impact (negative = suspicious, positive = human-authenticity signal).
function runChecks(codeText, commitCount) {
  const checks = [];
  const len = codeText.length || 1;

  // 1. Leftover AI conversational boilerplate
  const boilerplateHit = /as an ai|here is the code|hope this helps|certainly!|i cannot |as a language model/i.test(codeText);
  checks.push({
    label: 'Conversational AI residue',
    detail: boilerplateHit
      ? 'Leftover assistant-style phrasing found in comments or strings.'
      : 'No leftover AI chat phrasing detected.',
    delta: boilerplateHit ? -35 : 0,
    hit: boilerplateHit,
  });

  // 2. Checks for over-commenting, which AI usually does
  const comments = codeText.match(/\/\*[\s\S]*?\*\/|\/\/.*/g) || [];
  const density = comments.length > 0 ? len / comments.length : Infinity;
  const densityHit = comments.length > 3 && density < 60;
  checks.push(
      {
    label: 'Comment density',
    detail: densityHit
      ? 'Unusually high, uniform comment-to-code ratio (typical of AI narration).'
      : 'Comment density looks organic.',
    delta: densityHit ? -15 : 0,
    hit: densityHit,
  });

  // 3. Commit cadence
  const commits = parseInt(commitCount, 10) || 1;
  let commitDelta = 0;
  if (commits <= 1) commitDelta = -25;
  else if (commits <= 3) commitDelta = -15;
  else if (commits <= 6) commitDelta = -5;
  checks.push({
    label: 'Commit cadence',
    detail: `${commits} commit${commits === 1 ? '' : 's'} reported — ${
      commitDelta < -15 ? 'reads like a single copy-paste drop' :
      commitDelta < 0 ? 'a thin history for the amount of code' :
      'a believable iterative build history'
    }.`,
    delta: commitDelta,
    hit: commitDelta < 0,
  });

  // 4. Line-length uniformity
  const lines = codeText.split('\n').filter(l => l.trim().length > 0);
  let uniformityHit = false;
  if (lines.length >= 8) 
  {
    const lengths = lines.map(l => l.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
    const stddev = Math.sqrt(variance);
    uniformityHit = stddev < 6 && mean > 20;
  }
  checks.push({
    label: 'Formatting variance',
    detail: uniformityHit
      ? 'Line lengths are suspiciously uniform — little of the natural raggedness of hand-typed code.'
      : 'Natural variation in line length and structure.',
    delta: uniformityHit ? -10 : 0,
    hit: uniformityHit,
  });

  // 5. Human "mess" markers — TODOs, debug logs, commented-out old code
  const messHit = /todo|fixme|xxx|console\.log\(|\/\/ *(old|remove|temp|hack)/i.test(codeText);
  checks.push({
    label: 'Iteration residue',
    detail: messHit
      ? 'Found TODOs, debug logging, or leftover scaffolding — a normal fingerprint of real iteration.'
      : (lines.length > 20 ? 'Long, fully-polished file with zero iteration residue — a little too clean.' : 'File too short to judge iteration residue.'),
    delta: messHit ? 8 : (lines.length > 20 ? -8 : 0),
    hit: messHit,
  });

  // 6. Repetition ratio (near-duplicate lines, common in templated AI )
  let repetitionHit = false;
  if (lines.length >= 10) {
    const counts = new Map();
    lines.forEach(l => {
      const key = l.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const duplicates = [...counts.values()].filter(c => c > 1).reduce((a, b) => a + b, 0);
    repetitionHit = duplicates / lines.length > 0.35;
  }
  checks.push({
    label: 'Structural repetition',
    detail: repetitionHit
      ? 'High ratio of near-identical lines — consistent with templated generation.'
      : 'Low repetition, structure looks purpose-built.',
    delta: repetitionHit ? -10 : 0,
    hit: repetitionHit,
  });

  return checks;
}

function audit(codeText, commitCount) {
  const checks = runChecks(codeText, commitCount);
  let score = 100 + checks.reduce((sum, c) => sum + c.delta, 0);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict = 'Highly Authentic Human Work';
  if (score < 50) verdict = 'Flagged: Pure AI Generation Suspected';
  else if (score < 80) verdict = 'Mixed: AI-Assisted with Human Structure';

  const flags = checks.filter(c => c.hit).map(c => `${c.label}: ${c.detail}`);

  return { score, verdict, flags, checks };
}

app.post('/api/audit', (req, res) => {
  const { repoUrl, codeSample, commits } = req.body || {};

  if (!repoUrl || !codeSample) {
    return res.status(400).json({ error: 'Please provide both a repository link and a code snippet.' });
  }
  if (typeof codeSample !== 'string' || codeSample.length > 200000) {
    return res.status(400).json({ error: 'Code snippet is missing or too large (200KB max).' });
  }

  const result = audit(codeSample, commits || 1);
  res.json({
    repository: repoUrl,
    checkedAt: new Date().toLocaleTimeString(),
    ...result,
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fallback to the SPA shell for any non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CodePulse backend engine successfully online on port ${PORT}`));
