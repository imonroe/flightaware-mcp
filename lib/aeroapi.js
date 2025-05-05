const axios = require('axios');

class AeroApi {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('AeroAPI key is required');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = 'https://aeroapi.flightaware.com/aeroapi/v4';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-apikey': this.apiKey,
        'Accept': 'application/json'
      }
    });
    
    // Configure response interceptor for error handling
    this.client.interceptors.response.use(
      response => response.data,
      error => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // outside of the 2xx range
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
          const networkError = new Error('No response from AeroAPI server');
          networkError.code = 503;
          throw networkError;
        } else {
          // Something happened in setting up the request
          const setupError = new Error(`Error setting up request: ${error.message}`);
          setupError.code = 500;
          throw setupError;
        }
      }
    );
  }

  // Flight endpoints
  async getFlightByIdent(ident) {
    return this.client.get(`/flights/${ident}`);
  }
  
  async getFlightDetails(ident) {
    return this.client.get(`/flights/${ident}/details`);
  }
  
  // Airport endpoints
  async getAirportFlights(code, params = {}) {
    return this.client.get(`/airports/${code}/flights`, { params });
  }
  
  async getAirports(params = {}) {
    return this.client.get('/airports', { params });
  }
  
  // Aircraft endpoints
  async getAircraftByTail(tail) {
    return this.client.get(`/aircraft/${tail}`);
  }
  
  // Generic request method for future extensibility
  async request(method, path, params = {}) {
    // Normalize path to ensure it starts with a /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    return this.client({
      method,
      url: path,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });
  }
}

module.exports = AeroApi;