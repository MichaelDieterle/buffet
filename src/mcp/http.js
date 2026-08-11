const rateLimit = require('express-rate-limit');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const mcpServer = require('./server');

// Stateless mode: a fresh transport per request, no session IDs. The SDK
// requires a new transport for every request in stateless mode (reusing one
// causes message-ID collisions). Each request is independent, so this survives
// serverless cold starts on Vercel.
const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

async function handleMcp(req, res) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableSseResponse: true,
  });
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] transport error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

function mcpRouter() {
  const express = require('express');
  const router = express.Router();

  router.use(mcpLimiter);

  // Informational response for plain GETs (browsers, health checks).
  router.get('/', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ name: 'buffet-stock-tracker', protocol: 'streamable-http', status: 'ok' });
  });

  router.post('/', async (req, res) => {
    await handleMcp(req, res);
  });

  return router;
}

module.exports = { mcpRouter, handleMcp };
