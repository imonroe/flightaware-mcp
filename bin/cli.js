#!/usr/bin/env node

require('dotenv').config();
const { program } = require('commander');
const McpServer = require('../lib/mcp-server');
const packageJson = require('../package.json');

program
  .name('flightaware-mcp')
  .description('MCP server bridging to FlightAware AeroAPI')
  .version(packageJson.version)
  .option('-p, --port <number>', 'Port to listen on', process.env.MCP_SERVER_PORT || '8080')
  .option('-k, --aeroapi-key <string>', 'FlightAware AeroAPI key', process.env.AEROAPI_KEY)
  .option('-m, --mode <string>', 'Server mode (tcp or ws)', process.env.MCP_SERVER_MODE || 'tcp')
  .option('-t, --timeout <number>', 'Request timeout in milliseconds (increase if experiencing timeouts)', process.env.MCP_REQUEST_TIMEOUT || '30000')
  .option('-d, --debug', 'Enable debug mode with verbose logging', process.env.DEBUG === 'true')
  .addHelpText('after', `
Notes:
  - If you experience timeout errors (MCP error -32001), try increasing the timeout value.
  - Debug mode will provide detailed logs about requests and timeouts.
  - For n8n integrations, set a higher timeout value (60000 or more) if needed.

Environment variables:
  AEROAPI_KEY            FlightAware AeroAPI key
  MCP_SERVER_PORT        Port to listen on
  MCP_SERVER_MODE        Server mode (tcp or ws)
  MCP_REQUEST_TIMEOUT    Request timeout in milliseconds
  DEBUG                  Enable debug mode (true/false)
  LOG_LEVEL              Log level (error, warn, info, debug)
`)
  .parse(process.argv);

const options = program.opts();

if (!options.aeroapiKey) {
  console.error('Error: AeroAPI key is required. Provide via --aeroapi-key or AEROAPI_KEY environment variable.');
  process.exit(1);
}

const server = new McpServer({
  port: parseInt(options.port, 10),
  aeroapiKey: options.aeroapiKey,
  mode: options.mode,
  requestTimeout: parseInt(options.timeout, 10),
  debug: options.debug
});

server.start()
  .then(() => {
    console.log(`FlightAware MCP server running in ${options.mode} mode on port ${options.port}`);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.stop()
    .then(() => {
      console.log('Server stopped');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error stopping server:', err);
      process.exit(1);
    });
});