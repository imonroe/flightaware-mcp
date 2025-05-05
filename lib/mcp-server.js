const net = require('net');
const WebSocket = require('ws');
const AeroApi = require('./aeroapi');
const logger = require('./logger');

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
    this.requestTimeout = options.requestTimeout || 30000; // 30 second default timeout
    this.debug = options.debug || process.env.DEBUG === 'true';
    
    // Set logger level based on debug flag
    if (this.debug) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    logger.info(`MCP Server initializing (mode: ${this.mode}, timeout: ${this.requestTimeout}ms)`);
    
    // Initialize AeroAPI client with the same timeout
    this.aeroApi = new AeroApi(options.aeroapiKey, {
      timeout: this.requestTimeout
    });
    
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
        const clientId = `tcp:${socket.remoteAddress}:${socket.remotePort}`;
        this.clients.add(socket);
        socket._mcp_client_id = clientId; // Attach client ID to socket
        
        // Set socket timeout
        socket.setTimeout(this.requestTimeout);
        
        logger.debug(`TCP client connected: ${clientId}`);
        
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
          logger.debug(`TCP client disconnected: ${socket._mcp_client_id}`);
          this.clients.delete(socket);
        });

        socket.on('error', err => {
          logger.error(`Socket error for ${socket._mcp_client_id}`, err);
          this.clients.delete(socket);
        });
        
        socket.on('timeout', () => {
          logger.warn(`Socket timeout for ${socket._mcp_client_id}`);
          
          // Don't end the connection, just reset the timeout and send an error
          socket.setTimeout(0); // Disable timeout temporarily
          
          // Send timeout error response if there's a pending request
          const timeoutResponse = {
            id: null, // We don't know the request ID
            error: {
              code: -32001,
              message: 'Request timed out'
            }
          };
          
          try {
            socket.write(JSON.stringify(timeoutResponse) + '\n');
            // Reset the timeout
            socket.setTimeout(this.requestTimeout);
          } catch (err) {
            logger.error(`Failed to send timeout response to ${socket._mcp_client_id}`, err);
            this.clients.delete(socket);
            socket.destroy();
          }
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
        this.server = new WebSocket.Server({ 
          port: this.port,
          // Set WebSocket options
          clientTracking: true,
          perMessageDeflate: false,
          maxPayload: 100 * 1024 * 1024, // 100MB
          // Set ping interval and timeout
          pingInterval: Math.floor(this.requestTimeout / 3),
          pingTimeout: Math.floor(this.requestTimeout / 2)
        });
        
        this.server.on('connection', (ws, req) => {
          const clientId = `ws:${req.socket.remoteAddress}:${req.socket.remotePort}`;
          this.clients.add(ws);
          ws._mcp_client_id = clientId;
          
          logger.debug(`WebSocket client connected: ${clientId}`);
          
          // Keep track of last ping time
          ws._lastPingTime = Date.now();
          
          ws.on('message', message => {
            try {
              const request = JSON.parse(message.toString());
              logger.debug(`Processing WebSocket request: ${JSON.stringify(request)}`);
              
              this._handleMessage(request, (response) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(response));
                  logger.debug(`Sent WebSocket response for request ${request.id}`);
                } else {
                  logger.warn(`Cannot send response to ${ws._mcp_client_id}, socket not open`);
                }
              });
            } catch (err) {
              logger.error('Error processing WebSocket message:', err);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  id: null,
                  error: {
                    code: -32700,
                    message: 'Parse error'
                  }
                }));
              }
            }
          });

          ws.on('close', (code, reason) => {
            logger.debug(`WebSocket client disconnected: ${ws._mcp_client_id}, code: ${code}, reason: ${reason || 'No reason provided'}`);
            this.clients.delete(ws);
          });

          ws.on('error', err => {
            logger.error(`WebSocket error for ${ws._mcp_client_id}:`, err);
            this.clients.delete(ws);
          });
          
          // Add ping/pong for WebSocket timeout detection
          const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const now = Date.now();
              // Check if client hasn't responded to ping for too long
              if (ws._lastPingTime && now - ws._lastPingTime > this.requestTimeout) {
                logger.warn(`WebSocket client ${ws._mcp_client_id} ping timeout`);
                
                // Send timeout error response
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    id: null,
                    error: {
                      code: -32001,
                      message: 'Request timed out'
                    }
                  }));
                }
                
                // Terminate connection if it's been too long
                if (now - ws._lastPingTime > 2 * this.requestTimeout) {
                  logger.error(`Terminating unresponsive WebSocket client ${ws._mcp_client_id}`);
                  ws.terminate();
                  clearInterval(pingInterval);
                  return;
                }
              }
              
              // Send ping
              logger.debug(`Sending ping to ${ws._mcp_client_id}`);
              ws.ping(() => {
                // Ping callback
                ws._lastPingTime = Date.now();
              });
            }
          }, Math.floor(this.requestTimeout / 3));
          
          ws.on('pong', () => {
            // Reset timeout on pong response
            logger.debug(`Received pong from ${ws._mcp_client_id}`);
            ws._lastPingTime = Date.now();
          });
          
          ws.on('close', () => {
            logger.debug(`Clearing ping interval for ${ws._mcp_client_id}`);
            clearInterval(pingInterval);
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
    const requestId = request.id || 'unknown';
    const startTime = Date.now();
    
    // Log request
    logger.debug(`Processing request ${requestId}: ${request.method}`, request.params);
    
    // Validate request format
    if (!request.id || !request.method) {
      logger.warn(`Invalid request: ${JSON.stringify(request)}`);
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
      logger.warn(`Method '${request.method}' not found`);
      return sendResponse({
        id: request.id,
        error: {
          code: -32601,
          message: `Method '${request.method}' not found`
        }
      });
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          const timeoutMsg = `Request ${requestId} timed out after ${this.requestTimeout}ms`;
          logger.warn(timeoutMsg);
          const timeoutError = new Error('Request timed out');
          timeoutError.code = -32001;
          reject(timeoutError);
        }, this.requestTimeout);
        
        // Ensure the timeout is cleared if the promise is fulfilled
        timeoutPromise.cleanup = () => clearTimeout(timeoutId);
      });

      // Race the handler against the timeout
      try {
        const result = await Promise.race([
          handler(this.aeroApi, request.params || {}),
          timeoutPromise
        ]);
        
        // Clean up the timeout
        if (timeoutPromise.cleanup) {
          timeoutPromise.cleanup();
        }
        
        // Calculate execution time
        const executionTime = Date.now() - startTime;
        logger.debug(`Request ${requestId} completed in ${executionTime}ms`);
        
        // Send response
        sendResponse({
          id: request.id,
          result
        });
      } catch (err) {
        // Clean up the timeout
        if (timeoutPromise.cleanup) {
          timeoutPromise.cleanup();
        }
        
        throw err; // Re-throw to be caught by the outer catch
      }
    } catch (err) {
      const executionTime = Date.now() - startTime;
      logger.error(`Error handling '${request.method}' (${executionTime}ms):`, err);
      
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