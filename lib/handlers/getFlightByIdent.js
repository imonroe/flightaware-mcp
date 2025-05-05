/**
 * Handler for getFlightByIdent MCP method
 * Retrieves information about a specific flight by its identifier
 * 
 * @param {Object} aeroApi - AeroAPI client instance
 * @param {Object} params - Parameters from the MCP request
 * @param {string} params.ident - Flight identifier (e.g., "AAL100")
 * @returns {Promise<Object>} Flight information
 */
async function getFlightByIdent(aeroApi, params) {
  if (!params.ident) {
    const error = new Error('Flight identifier (ident) is required');
    error.code = 400;
    throw error;
  }

  const flightData = await aeroApi.getFlightByIdent(params.ident);
  
  // The AeroAPI response is already in a suitable format, but we could
  // transform it here if needed to match MCP conventions
  return flightData;
}

module.exports = getFlightByIdent;