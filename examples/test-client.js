#!/usr/bin/env node

const net = require('net');
const WebSocket = require('ws');
const readline = require('readline');

// Configuration
const HOST = '127.0.0.1';
const PORT = process.env.MCP_SERVER_PORT || 8080;
const MODE = (process.env.MCP_SERVER_MODE || 'tcp').toLowerCase();

// Create interface for reading from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let client;
let requestId = 1;

function connectTcp() {
  client = new net.Socket();
  let buffer = '';

  client.connect(PORT, HOST, () => {
    console.log(`Connected to server on ${HOST}:${PORT} using TCP`);
    displayMenu();
  });

  client.on('data', (data) => {
    buffer += data.toString();
    
    // Try to process complete JSON messages
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const message = buffer.substring(0, newlineIndex);
      buffer = buffer.substring(newlineIndex + 1);
      
      try {
        const response = JSON.parse(message);
        console.log('\nServer response:');
        console.log(JSON.stringify(response, null, 2));
        console.log('\nEnter a command:');
      } catch (error) {
        console.error('Error parsing response:', error);
      }
    }
  });

  client.on('close', () => {
    console.log('Connection closed');
    rl.close();
  });

  client.on('error', (err) => {
    console.error('Connection error:', err);
    rl.close();
  });

  return client;
}

function connectWebSocket() {
  const ws = new WebSocket(`ws://${HOST}:${PORT}`);

  ws.on('open', () => {
    console.log(`Connected to server on ${HOST}:${PORT} using WebSocket`);
    client = ws;
    displayMenu();
  });

  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('\nServer response:');
      console.log(JSON.stringify(response, null, 2));
      console.log('\nEnter a command:');
    } catch (error) {
      console.error('Error parsing response:', error);
    }
  });

  ws.on('close', () => {
    console.log('Connection closed');
    rl.close();
  });

  ws.on('error', (err) => {
    console.error('Connection error:', err);
    rl.close();
  });

  return ws;
}

function displayMenu() {
  console.log('\nAvailable commands:');
  console.log('1. Get flight by identifier');
  console.log('2. Get flights for airport');
  console.log('3. Get aircraft by tail number');
  console.log('4. Get airports by region');
  console.log('5. Get flight details');
  console.log('6. Exit');
  console.log('\nEnter a command number:');
}

function sendRequest(method, params) {
  const request = {
    id: `req${requestId++}`,
    method,
    params
  };
  
  const requestStr = JSON.stringify(request);
  
  if (MODE === 'tcp') {
    client.write(requestStr + '\n');
  } else {
    client.send(requestStr);
  }
  
  console.log('\nSent request:');
  console.log(JSON.stringify(request, null, 2));
}

function getFlightByIdent() {
  rl.question('Enter flight identifier (e.g., AAL100): ', (ident) => {
    sendRequest('getFlightByIdent', { ident });
  });
}

function getFlightsForAirport() {
  rl.question('Enter airport code (e.g., KJFK): ', (airport_code) => {
    rl.question('Include arrivals? (y/n): ', (arrivals) => {
      rl.question('Include departures? (y/n): ', (departures) => {
        const params = {
          airport_code,
          arrivals: arrivals.toLowerCase() === 'y',
          departures: departures.toLowerCase() === 'y'
        };
        sendRequest('getFlightsForAirport', params);
      });
    });
  });
}

function getAircraftByTail() {
  rl.question('Enter aircraft tail number (e.g., N12345): ', (tail) => {
    sendRequest('getAircraftByTail', { tail });
  });
}

function getAirportsByRegion() {
  rl.question('Enter country code (optional, e.g., US): ', (country) => {
    rl.question('Enter region/state code (optional, e.g., CA): ', (region) => {
      rl.question('Enter search query (optional): ', (query) => {
        const params = {};
        if (country) params.country = country;
        if (region) params.region = region;
        if (query) params.query = query;
        
        sendRequest('getAirportsByRegion', params);
      });
    });
  });
}

function getFlightDetails() {
  rl.question('Enter flight identifier (e.g., AAL100): ', (ident) => {
    sendRequest('getFlightDetails', { ident });
  });
}

function handleCommand(command) {
  switch (command) {
    case '1':
      getFlightByIdent();
      break;
    case '2':
      getFlightsForAirport();
      break;
    case '3':
      getAircraftByTail();
      break;
    case '4':
      getAirportsByRegion();
      break;
    case '5':
      getFlightDetails();
      break;
    case '6':
      console.log('Exiting...');
      if (client) {
        if (MODE === 'tcp') {
          client.end();
        } else {
          client.close();
        }
      }
      rl.close();
      break;
    default:
      console.log('Invalid command');
      displayMenu();
      break;
  }
}

// Connect and start the CLI
console.log(`Connecting to MCP server (${MODE.toUpperCase()}) at ${HOST}:${PORT}...`);

// Initialize the appropriate client
if (MODE === 'tcp') {
  connectTcp();
} else if (MODE === 'ws') {
  connectWebSocket();
} else {
  console.error(`Unsupported mode: ${MODE}`);
  process.exit(1);
}

// Handle user input
rl.on('line', (line) => {
  handleCommand(line.trim());
});

rl.on('close', () => {
  process.exit(0);
});