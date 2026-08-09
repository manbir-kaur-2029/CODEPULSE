const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

const app = express();

// Middleware setup
app.use(express.json({ limit: '10mb' })); // Limit input size
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
});
app.use(limiter);

// Enforce HTTPS and set security headers
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    // Redirect to HTTPS
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  // Set HSTS header
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Main route
app.post('/check', (req, res) => {
  try {
    // Validate and sanitize input
    const codeInputRaw = req.body.code;
    const commitCountRaw = req.body.commitCount;

    if (typeof codeInputRaw !== 'string' || typeof commitCountRaw !== 'string') {
      return res.status(400).send('Invalid input types.');
    }

    const codeText = validator.escape(codeInputRaw);
    const commitCountStr = validator.escape(commitCountRaw);

    // Parse commit count
    const commitCount = parseInt(commitCountStr, 10);
    if (isNaN(commitCount) || commitCount < 0) {
      return res.status(400).send('Invalid commit count.');
    }

    // Check input size limit
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (codeText.length > MAX_SIZE) {
      return res.status(413).send('Input too large.');
    }

    // Run checks
    const results = runChecks(codeText, commitCount);
    res.json(results);
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).send('Server Error');
  }
});

// Function: runChecks
function runChecks(codeText, commitCount) {
  // Initialize constants for thresholds
  const COMMENT_THRESHOLD = 35;
  const LINE_THRESHOLD = 15;
  const DENSITY_THRESHOLD = 0.05;
  
  // Count lines
  const lines = codeText.split(/\r?\n/);
  const totalLines = lines.length;

  // Count comments with safer regex (avoid nested quantifiers)
  const commentRegex = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  const comments = codeText.match(commentRegex) || [];
  const commentCount = comments.length;

  // Compute comment density safely
  const density = totalLines === 0 ? 0 : commentCount / totalLines;

  // Check for large code
  const isLargeCode = codeText.length > 1_000_000; // Example threshold

  // Return results
  return {
    totalLines,
    commentCount,
    density,
    commitCount,
    isLargeCode,
    // Additional metrics can be added here
  };
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
