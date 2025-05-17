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
        'Content-Type': 'application/json'
      },
      // Add cache control to prevent HTTP/2 protocol issues
      cache: 'no-cache',
      // Add keepalive to prevent connection issues
      keepalive: true,
      // Add credentials mode to prevent CORS issues
      credentials: 'omit',
      // Add mode to prevent CORS issues
      mode: 'cors'
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
    
    // Return the data from the backend which already has timestamps
    console.log('Processed data sample:', data.length > 0 ? data[0] : 'No items');
    
    return data;
  } catch (error) {
    console.error('Error fetching items from Lambda API:', error);
    return []; // Return empty array instead of throwing to prevent app crashes
  }
};

/**
 * Marks an article as consumed by the app
 * @param {number} index - The index of the article that was consumed
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
const markArticleAsConsumed = async (index) => {
  try {
    // Use the base URL of the API Gateway stage
    const apiUrl = 'https://b6zibzuazj.execute-api.us-east-1.amazonaws.com/LFG/LinkSimulation/consumed';
    
    console.log(`Marking article at index ${index} as consumed`);
    
    // Call the Lambda API to mark the article as consumed
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ index }),
      // Add cache control to prevent HTTP/2 protocol issues
      cache: 'no-cache',
      // Add keepalive to prevent connection issues
      keepalive: true,
      // Add credentials mode to prevent CORS issues
      credentials: 'omit',
      // Add mode to prevent CORS issues
      mode: 'cors'
    });
    
    console.log('Mark consumed response status:', response.status);
    
    // Check if the response is ok
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error marking as consumed:', errorText);
      return false;
    }
    
    // Parse the JSON response
    const data = await response.json();
    console.log('Mark consumed response:', data);
    
    return true;
  } catch (error) {
    console.error('Error marking article as consumed:', error);
    return false;
  }
};

export { fetchItemsWithValidUrls, markArticleAsConsumed };
