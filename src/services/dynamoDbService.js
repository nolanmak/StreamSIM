/**
 * Fetches all items from the DynamoDB table that have a valid URL in their link property
 * This uses a secure AWS Lambda function to access DynamoDB
 * @returns {Promise<Array>} - Array of items with valid URLs
 */
const fetchItemsWithValidUrls = async () => {
  try {
    // Use the base URL of the API Gateway stage
    const apiUrl = 'https://b6zibzuazj.execute-api.us-east-1.amazonaws.com/LFG/LinkSimulation';
    
    console.log('Fetching data from:', apiUrl);
    
    // Call the Lambda API to get items with valid URLs
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    console.log('Response status:', response.status);
    
    // Check if the response is ok
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`API error: ${response.status}`);
    }
    
    // Parse the JSON response
    const data = await response.json();
    console.log('Data received type:', typeof data);
    console.log('Data is array:', Array.isArray(data));
    console.log('Data length:', Array.isArray(data) ? data.length : 'N/A');
    
    // Validate the response structure
    if (!data) {
      console.error('API returned null or undefined data');
      return [];
    }
    
    if (!Array.isArray(data)) {
      console.error('API did not return an array:', data);
      // If it's an object with Items property (DynamoDB format), use that
      if (data.Items && Array.isArray(data.Items)) {
        console.log('Using Items property from response');
        return data.Items;
      }
      // Otherwise return empty array
      return [];
    }
    
    // Process the data to ensure all items have required fields
    const processedData = data.map(item => {
      // Ensure each item has publishTimestamp and publishedAt
      if (!item.publishTimestamp || !item.publishedAt) {
        const now = new Date();
        return {
          ...item,
          publishedAt: item.publishedAt || now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
          }),
          publishTimestamp: item.publishTimestamp || now.getTime()
        };
      }
      return item;
    });
    
    console.log('Processed data sample:', processedData.length > 0 ? processedData[0] : 'No items');
    
    return processedData;
  } catch (error) {
    console.error('Error fetching items from Lambda API:', error);
    return []; // Return empty array instead of throwing to prevent app crashes
  }
};

export { fetchItemsWithValidUrls };
