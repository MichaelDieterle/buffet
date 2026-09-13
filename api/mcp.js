// Dedicated Vercel serverless entrypoint for the remote MCP endpoint.
// Keeping MCP in its own function avoids relying on a rewrite to the main
// Express function, which can otherwise lose the /mcp path during routing.
const express = require('express');
const { mcpRouter } = require('../src/mcp/http');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/', mcpRouter());

module.exports = app;
