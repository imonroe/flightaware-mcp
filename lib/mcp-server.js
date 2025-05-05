const net = require('net');
const WebSocket = require('ws');
const AeroApi = require('./aeroapi');

// Import handlers
const getFlightByIdent = require('./handlers/getFlightByIdent');
const getFlightsForAirport = require('./handlers/getFlightsForAirport');
const getAircraftByTail = require('./handlers/getAircraftByTail');
const getAirportsByRegion = require('./handlers/getAirportsByRegion');
const getFlightDetails = require('./handlers/getFlightDetails');

class McpServer {
  constructor(options) {
    this.port = options.port || 8080;
    this.mode = (options.mode || 'tcp').toLowerCase();
    this.server = null;
    this.clients = new Set();
    
    // Initialize AeroAPI client
    this.aeroApi = new AeroApi(options.aeroapiKey);
    
    // Method handlers mapping
    this.handlers = {
      getFlightByIdent: getFlightByIdent,
      getFlightsForAirport: getFlightsForAirport,
      getAircraftByTail: getAircraftByTail,
      getAirportsByRegion: getAirportsByRegion,
      getFlightDetails: getFlightDetails
    };
  }

  async start() {
    if (this.mode === 'tcp') {
      return this._startTcpServer();
    } else if (this.mode === 'ws') {
      return this._startWebSocketServer();
    } else {
      throw new Error(`Unsupported server mode: ${this.mode}`);
    }
  }

  async stop() {
    if (!this.server) {
      return;
    }

    // Close all client connections
    for (const client of this.clients) {
      if (this.mode === 'tcp') {
        client.end();
      } else if (this.mode === 'ws') {
        client.close();
      }
    }

    // Close the server
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  _startTcpServer() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer(socket => {
        this.clients.add(socket);
        
        let buffer = '';
        
        socket.on('data', data => {
          buffer += data.toString();
          
          // Try to parse complete JSON messages
          try {
            // Simple approach: one JSON message per line
            const messages = buffer.split('\n');
            buffer = messages.pop(); // Keep the last incomplete message in buffer
            
            for (const message of messages) {
              if (message.trim()) {
                this._handleMessage(JSON.parse(message), (response) => {
                  socket.write(JSON.stringify(response) + '\n');
                });
              }
            }
          } catch (err) {
            // Incomplete or invalid JSON, continue buffering
          }
        });

        socket.on('close', () => {
          this.clients.delete(socket);
        });

        socket.on('error', err => {
          console.error('Socket error:', err);
          this.clients.delete(socket);
        });
      });

      this.server.on('error', err => {
        reject(err);
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  _startWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocket.Server({ port: this.port });
        
        this.server.on('connection', ws => {
          this.clients.add(ws);
          
          ws.on('message', message => {
            try {
              const request = JSON.parse(message.toString());
              this._handleMessage(request, (response) => {
                ws.send(JSON.stringify(response));
              });
            } catch (err) {
              console.error('Error processing WebSocket message:', err);
              ws.send(JSON.stringify({
                id: null,
                error: {
                  code: -32700,
                  message: 'Parse error'
                }
              }));
            }
          });

          ws.on('close', () => {
            this.clients.delete(ws);
          });

          ws.on('error', err => {
            console.error('WebSocket error:', err);
            this.clients.delete(ws);
          });
        });

        this.server.on('error', err => {
          reject(err);
        });

        this.server.on('listening', () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async _handleMessage(request, sendResponse) {
    // Validate request format
    if (!request.id || !request.method) {
      return sendResponse({
        id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid request'
        }
      });
    }

    // Find handler for the requested method
    const handler = this.handlers[request.method];
    if (!handler) {
      return sendResponse({
        id: request.id,
        error: {
          code: -32601,
          message: `Method '${request.method}' not found`
        }
      });
    }

    try {
      // Execute the handler with the AeroAPI client and parameters
      const result = await handler(this.aeroApi, request.params || {});
      sendResponse({
        id: request.id,
        result
      });
    } catch (err) {
      console.error(`Error handling '${request.method}':`, err);
      
      // Format error response
      sendResponse({
        id: request.id,
        error: {
          code: err.code || 500,
          message: err.message || 'Internal error'
        }
      });
    }
  }
}

module.exports = McpServer;