const axios = require('axios');
const logger = require('./logger');

class AeroApi {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('AeroAPI key is required');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = 'https://aeroapi.flightaware.com/aeroapi/v4';
    this.timeout = options.timeout || 30000; // 30 second default timeout
    
    logger.info(`Initializing AeroAPI client (timeout: ${this.timeout}ms)`);
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-apikey': this.apiKey,
        'Accept': 'application/json'
      },
      timeout: this.timeout,
      // Retry logic
      maxRetries: 3,
      retryDelay: 1000,
      // Make sure we get proper timeouts
      proxy: false,
      // Connection timeout
      httpAgent: new (require('http').Agent)({ keepAlive: true, timeout: this.timeout }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true, timeout: this.timeout })
    });
    
    // Configure request interceptor for logging
    this.client.interceptors.request.use(config => {
      const requestId = Math.random().toString(36).substring(2, 10);
      config.requestId = requestId;
      logger.debug(`AeroAPI request ${requestId}: ${config.method} ${config.url}`);
      return config;
    });
    
    // Configure response interceptor for error handling
    this.client.interceptors.response.use(
      response => {
        const requestId = response.config.requestId;
        const duration = response.headers['x-runtime'] ? 
          Math.round(parseFloat(response.headers['x-runtime']) * 1000) : 
          'unknown';
        
        logger.debug(`AeroAPI success ${requestId} (${duration}ms): ${response.status}`);
        return response.data;
      },
      error => {
        const requestId = error.config ? error.config.requestId : 'unknown';
        
        if (error.response) {
          // The request was made and the server responded with a status code
          // outside of the 2xx range
          logger.error(`AeroAPI error ${requestId}: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
          
          const aeroapiError = new Error(
            error.response.data.message || 
            error.response.data.error || 
            `AeroAPI error: ${error.response.status}`
          );
          aeroapiError.code = error.response.status;
          aeroapiError.data = error.response.data;
          throw aeroapiError;
        } else if (error.request) {
          // The request was made but no response was received
          if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            // Handle timeout specifically
            logger.error(`AeroAPI timeout ${requestId}: ${error.message}`);
            const timeoutError = new Error('AeroAPI request timed out');
            timeoutError.code = -32001; // Standard JSON-RPC timeout error code
            timeoutError.originalError = error;
            throw timeoutError;
          }
          
          logger.error(`AeroAPI network error ${requestId}: ${error.message}`);
          const networkError = new Error(`No response from AeroAPI server: ${error.message}`);
          networkError.code = 503;
          networkError.originalError = error;
          throw networkError;
        } else {
          // Something happened in setting up the request
          logger.error(`AeroAPI setup error ${requestId}: ${error.message}`);
          const setupError = new Error(`Error setting up request: ${error.message}`);
          setupError.code = 500;
          setupError.originalError = error;
          throw setupError;
        }
      }
    );
  }

  // Flight endpoints
  async getFlightByIdent(ident) {
    logger.debug(`AeroAPI.getFlightByIdent: ${ident}`);
    try {
      return await this.client.get(`/flights/${ident}`);
    } catch (err) {
      logger.error(`Error in getFlightByIdent(${ident}):`, err);
      throw err;
    }
  }
  
  async getFlightDetails(ident) {
    logger.debug(`AeroAPI.getFlightDetails: ${ident}`);
    try {
      return await this.client.get(`/flights/${ident}/details`);
    } catch (err) {
      logger.error(`Error in getFlightDetails(${ident}):`, err);
      throw err;
    }
  }
  
  // Airport endpoints
  async getAirportFlights(code, params = {}) {
    logger.debug(`AeroAPI.getAirportFlights: ${code}`, params);
    try {
      return await this.client.get(`/airports/${code}/flights`, { params });
    } catch (err) {
      logger.error(`Error in getAirportFlights(${code}):`, err);
      throw err;
    }
  }
  
  async getAirports(params = {}) {
    logger.debug(`AeroAPI.getAirports`, params);
    try {
      return await this.client.get('/airports', { params });
    } catch (err) {
      logger.error(`Error in getAirports():`, err);
      throw err;
    }
  }
  
  // Aircraft endpoints
  async getAircraftByTail(tail) {
    logger.debug(`AeroAPI.getAircraftByTail: ${tail}`);
    try {
      return await this.client.get(`/aircraft/${tail}`);
    } catch (err) {
      logger.error(`Error in getAircraftByTail(${tail}):`, err);
      throw err;
    }
  }
  
  // Generic request method for future extensibility
  async request(method, path, params = {}) {
    // Normalize path to ensure it starts with a /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    logger.debug(`AeroAPI.request: ${method} ${path}`, params);
    
    try {
      return await this.client({
        method,
        url: path,
        params: method === 'get' ? params : undefined,
        data: method !== 'get' ? params : undefined
      });
    } catch (err) {
      logger.error(`Error in request(${method}, ${path}):`, err);
      throw err;
    }
  }
}

module.exports = AeroApi;