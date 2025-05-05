/**
 * Handler for getAirportsByRegion MCP method
 * Searches for airports in a specific country/region
 * 
 * @param {Object} aeroApi - AeroAPI client instance
 * @param {Object} params - Parameters from the MCP request
 * @param {string} [params.country] - Country code (e.g., "US")
 * @param {string} [params.region] - Region/state code (e.g., "CA")
 * @param {string} [params.query] - Search query for airport name or code
 * @returns {Promise<Object>} List of matching airports
 */
async function getAirportsByRegion(aeroApi, params) {
  // At least one search parameter should be provided
  if (!params.country && !params.region && !params.query) {
    const error = new Error('At least one search parameter (country, region, or query) is required');
    error.code = 400;
    throw error;
  }

  // Build parameters for AeroAPI
  const apiParams = {};
  if (params.country) {
    apiParams.country = params.country;
  }
  if (params.region) {
    apiParams.region = params.region;
  }
  if (params.query) {
    apiParams.query = params.query;
  }

  const airportsData = await aeroApi.getAirports(apiParams);
  
  // Return a properly formatted response for MCP
  return {
    count: airportsData.count || airportsData.airports?.length || 0,
    airports: airportsData.airports || []
  };
}

module.exports = getAirportsByRegion;