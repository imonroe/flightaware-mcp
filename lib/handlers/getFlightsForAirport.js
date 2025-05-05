/**
 * Handler for getFlightsForAirport MCP method
 * Retrieves flights arriving at or departing from a specific airport
 * 
 * @param {Object} aeroApi - AeroAPI client instance
 * @param {Object} params - Parameters from the MCP request
 * @param {string} params.airport_code - Airport ICAO code (e.g., "KJFK")
 * @param {boolean} [params.arrivals=true] - Include arriving flights
 * @param {boolean} [params.departures=true] - Include departing flights
 * @param {string} [params.type="all"] - Type of flights to include ("airline", "general_aviation", "all")
 * @returns {Promise<Object>} Airport flight information
 */
async function getFlightsForAirport(aeroApi, params) {
  if (!params.airport_code) {
    const error = new Error('Airport code is required');
    error.code = 400;
    throw error;
  }

  // Build parameters for AeroAPI
  const apiParams = {};
  
  // Set type if provided
  if (params.type && ['airline', 'general_aviation', 'all'].includes(params.type)) {
    apiParams.type = params.type;
  }
  
  // Determine which flight types to include
  if (params.arrivals === true && params.departures !== true) {
    apiParams.filter = 'arrivals';
  } else if (params.arrivals !== true && params.departures === true) {
    apiParams.filter = 'departures';
  }

  const flightData = await aeroApi.getAirportFlights(params.airport_code, apiParams);
  
  // Return the flight data in a format that matches MCP expectations
  return {
    airport_code: params.airport_code,
    flights: flightData.arrivals || flightData.departures || flightData
  };
}

module.exports = getFlightsForAirport;