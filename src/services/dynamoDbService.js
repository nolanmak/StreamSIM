/**
 * Fetches all items from the DynamoDB table that have a valid URL in their link property
 * This uses a secure AWS Lambda function to access DynamoDB
 * @returns {Promise<Array>} - Array of items with valid URLs
 */
export const fetchItemsWithValidUrls = async () => {
  try {
    // Use the base URL of the API Gateway stage
    // Based on our testing, we'll use the LFG stage endpoint
    const apiUrl = 'https://cvuu38def1.execute-api.us-east-1.amazonaws.com/lfg';
    
    console.log('Fetching data from:', apiUrl);
    
    // Call the Lambda API to get items with valid URLs
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
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
    console.log('Data received:', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching items from Lambda API:', error);
    throw error;
  }
};
