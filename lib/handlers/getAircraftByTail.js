/**
 * Handler for getAircraftByTail MCP method
 * Retrieves information about a specific aircraft by its tail number
 * 
 * @param {Object} aeroApi - AeroAPI client instance
 * @param {Object} params - Parameters from the MCP request
 * @param {string} params.tail - Aircraft tail number (e.g., "N12345")
 * @returns {Promise<Object>} Aircraft information
 */
async function getAircraftByTail(aeroApi, params) {
  if (!params.tail) {
    const error = new Error('Aircraft tail number is required');
    error.code = 400;
    throw error;
  }

  const aircraftData = await aeroApi.getAircraftByTail(params.tail);
  
  // The AeroAPI response is already in a suitable format, but we could
  // transform it here if needed to match MCP conventions
  return aircraftData;
}

module.exports = getAircraftByTail;