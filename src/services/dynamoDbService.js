/**
 * Fetches all items from the DynamoDB table that have a valid URL in their link property
 * This uses a secure AWS Lambda function to access DynamoDB
 * @returns {Promise<Object>} - Object containing articles array and cycle information
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
    
    // Validate the response structure
    if (!data) {
      console.error('API returned null or undefined data');
      return { articles: [], cycleInfo: null };
    }
    
    // Handle the new response format where articles are in data.articles
    if (data.articles && Array.isArray(data.articles)) {
      console.log('Using new response format with articles property');
      console.log('Articles length:', data.articles.length);
      console.log('Cycle info:', data.cycleResult);
      
      return {
        articles: data.articles,
        cycleInfo: data.cycleResult || null
      };
    }
    
    // Handle legacy format where the response is just an array of articles
    if (Array.isArray(data)) {
      console.log('Using legacy response format (direct array)');
      console.log('Data length:', data.length);
      
      return {
        articles: data,
        cycleInfo: null
      };
    }
    
    // Handle DynamoDB format with Items property
    if (data.Items && Array.isArray(data.Items)) {
      console.log('Using Items property from response');
      
      return {
        articles: data.Items,
        cycleInfo: null
      };
    }
    
    // If we can't determine the format, return empty
    console.error('Unknown API response format:', data);
    return { articles: [], cycleInfo: null };
    
  } catch (error) {
    console.error('Error fetching items from Lambda API:', error);
    return { articles: [], cycleInfo: null }; // Return empty object instead of throwing to prevent app crashes
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

/**
 * Fetches only the current article from the DynamoDB table
 * @returns {Promise<Object>} - The current article
 */
const fetchCurrentArticle = async () => {
  try {
    // Use the base URL of the API Gateway stage
    const apiUrl = 'https://b6zibzuazj.execute-api.us-east-1.amazonaws.com/LFG/LinkSimulation/current';
    
    console.log('Fetching current article from:', apiUrl);
    
    // Call the Lambda API to get the current article
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
    console.log('Current article received:', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching current article:', error);
    return null; // Return null on error
  }
};

export { fetchItemsWithValidUrls, markArticleAsConsumed, fetchCurrentArticle };
