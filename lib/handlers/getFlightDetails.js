/**
 * Handler for getFlightDetails MCP method
 * Retrieves detailed information about a specific flight
 * 
 * @param {Object} aeroApi - AeroAPI client instance
 * @param {Object} params - Parameters from the MCP request
 * @param {string} params.ident - Flight identifier (e.g., "AAL100")
 * @returns {Promise<Object>} Detailed flight information
 */
async function getFlightDetails(aeroApi, params) {
  if (!params.ident) {
    const error = new Error('Flight identifier (ident) is required');
    error.code = 400;
    throw error;
  }

  const flightDetails = await aeroApi.getFlightDetails(params.ident);
  
  // The AeroAPI response is already in a suitable format, but we could
  // transform it here if needed to match MCP conventions
  return flightDetails;
}

module.exports = getFlightDetails;