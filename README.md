# FlightAware MCP Server

A bridge server connecting Model Context Protocol (MCP) clients to FlightAware's AeroAPI for real-time aviation data.

## Features

- **Flight Information**: Get real-time information about specific flights
- **Airport Operations**: Track arriving and departing flights at airports
- **Aircraft Details**: Retrieve aircraft information by tail number
- **Airport Search**: Find airports by region, country, or custom query
- **Detailed Tracking**: Get comprehensive flight operation details
- **Flexible Protocol Support**: Works with both TCP and WebSocket connections
- **Easy Configuration**: Simple setup via environment variables or command line

## MCP Tools

This server provides the following tools via the MCP interface:

### `getFlightByIdent`

Get information about a specific flight using its identifier.

```json
{
  "id": "req123",
  "method": "getFlightByIdent",
  "params": {
    "ident": "AAL100"
  }
}
```

### `getFlightsForAirport`

List flights arriving at or departing from a specific airport.

```json
{
  "id": "req124",
  "method": "getFlightsForAirport",
  "params": {
    "airport_code": "KJFK",
    "arrivals": true,
    "departures": true,
    "type": "all"
  }
}
```

### `getAircraftByTail`

Get information about a specific aircraft by its tail number.

```json
{
  "id": "req125",
  "method": "getAircraftByTail",
  "params": {
    "tail": "N12345"
  }
}
```

### `getAirportsByRegion`

Search for airports by country, region, or custom query.

```json
{
  "id": "req126",
  "method": "getAirportsByRegion",
  "params": {
    "country": "US",
    "region": "CA",
    "query": "international"
  }
}
```

### `getFlightDetails`

Get detailed information about a specific flight.

```json
{
  "id": "req127",
  "method": "getFlightDetails",
  "params": {
    "ident": "AAL100"
  }
}
```

## Configuration

### AeroAPI Key

You'll need a FlightAware AeroAPI key to use this server. 
- Sign up at [FlightAware AeroAPI](https://flightaware.com/aeroapi/)
- Follow their instructions to obtain an API key

### Installation

#### Using NPX (No installation required)

Run directly with npx:

```bash
npx flightaware-mcp --port 8080 --aeroapi-key YOUR_API_KEY
```

#### Global Installation

Install globally and run from anywhere:

```bash
npm install -g flightaware-mcp
flightaware-mcp --port 8080 --aeroapi-key YOUR_API_KEY
```

#### Local Installation

Install locally in your project:

```bash
npm install flightaware-mcp
```

Then add to your `package.json` scripts:

```json
"scripts": {
  "start-mcp": "flightaware-mcp --port 8080"
}
```

### Command Line Options

```
Usage: flightaware-mcp [options]

Options:
  -V, --version               output the version number
  -p, --port <number>         Port to listen on (default: "8080")
  -k, --aeroapi-key <string>  FlightAware AeroAPI key
  -m, --mode <string>         Server mode (tcp or ws) (default: "tcp")
  -t, --timeout <number>      Request timeout in milliseconds (default: "30000")
  -d, --debug                 Enable debug mode with verbose logging
  -h, --help                  display help for command

Notes:
  - If you experience timeout errors (MCP error -32001), try increasing the timeout value.
  - Debug mode will provide detailed logs about requests and timeouts.
  - For n8n integrations, set a higher timeout value (60000 or more) if needed.
```

### Environment Variables

You can use environment variables instead of command line arguments:

```
AEROAPI_KEY=your_api_key
MCP_SERVER_PORT=8080
MCP_SERVER_MODE=tcp  # or ws for WebSocket
MCP_REQUEST_TIMEOUT=60000  # timeout in milliseconds, increase if experiencing timeouts
DEBUG=true  # enable debug mode with verbose logging
LOG_LEVEL=info  # log level (error, warn, info, debug)
```

## Usage Examples

### MCP Client Configuration

For MCP clients that support server configuration, you can use this configuration:

```json
{
  "mcpServers": {
    "flightaware": {
      "command": "npx",
      "args": [
        "-y",
        "flightaware-mcp"
      ],
      "env": {
        "AEROAPI_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### Sample MCP Client Code

```javascript
const net = require('net');

const client = new net.Socket();
client.connect(8080, '127.0.0.1', () => {
  console.log('Connected to MCP server');
  
  // Request flight information
  const request = {
    id: 'req1',
    method: 'getFlightByIdent',
    params: {
      ident: 'UAL123'
    }
  };
  
  client.write(JSON.stringify(request) + '\n');
});

client.on('data', (data) => {
  const response = JSON.parse(data.toString().trim());
  console.log('Received response:', response);
  client.end();
});

client.on('close', () => {
  console.log('Connection closed');
});
```

### Testing with Included Client

This package includes a test client for easy testing:

```bash
# First, start the server
npm start

# In another terminal, run the test client
npm run client
```

## Development

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd flightaware-mcp

# Install dependencies
npm install

# Start development server
npm start
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Timeout Errors

If you're experiencing timeout errors (`MCP error -32001: Request timed out`), try these solutions:

1. **Increase the timeout value:**
   ```bash
   # With command line
   flightaware-mcp --timeout 60000
   
   # With environment variables
   MCP_REQUEST_TIMEOUT=60000 flightaware-mcp
   ```

2. **Enable debug mode to get more information:**
   ```bash
   flightaware-mcp --debug
   ```

3. **Check your network connectivity:**
   - Ensure your server has stable internet access
   - Check if there are any firewall rules blocking outbound requests

4. **For n8n integration:**
   - Set a higher timeout value (60000ms or more)
   - Make sure the MCP server and n8n can communicate properly
   - Try both TCP and WebSocket modes (`--mode ws` or `--mode tcp`)

5. **Check AeroAPI rate limits:**
   - FlightAware AeroAPI has rate limits based on your subscription
   - Enable debug mode to see detailed API response information

## License

MIT