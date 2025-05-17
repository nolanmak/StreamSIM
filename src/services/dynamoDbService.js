/**
 * Fetches the next article from the Lambda function
 * @returns {Promise<Object>} - Object containing the next article, metadata, and cycle articles
 */
const fetchNextArticle = async () => {
  try {
    // Use the base URL of the API Gateway stage
    const apiUrl = 'https://b6zibzuazj.execute-api.us-east-1.amazonaws.com/LFG/LinkSimulation';
    
    console.log('Fetching next article from:', apiUrl);
    
    // Call the Lambda API to get the next article
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
    console.log('Next article data:', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching next article:', error);
    throw error;
  }
};

/**
 * Fetches all articles for the current cycle
 * @returns {Promise<Array>} - Array of articles for the current cycle
 */
const fetchCurrentCycleArticles = async () => {
  try {
    // Use the base URL of the API Gateway stage
    const apiUrl = 'https://b6zibzuazj.execute-api.us-east-1.amazonaws.com/LFG/LinkSimulation/cycle-articles';
    
    console.log('Fetching cycle articles from:', apiUrl);
    
    // Call the Lambda API to get all articles for the current cycle
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
    console.log('Cycle articles data:', data);
    
    return data.cycleArticles || [];
  } catch (error) {
    console.error('Error fetching cycle articles:', error);
    return [];
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
 * Resets the cycle in the Lambda function
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
const resetCycle = async () => {
  try {
    // Use the base URL of the API Gateway stage
    const apiUrl = 'https://b6zibzuazj.execute-api.us-east-1.amazonaws.com/LFG/LinkSimulation/reset';
    
    console.log('Resetting cycle');
    
    // Call the Lambda API to reset the cycle
    const response = await fetch(apiUrl, {
      method: 'POST',
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
    
    console.log('Reset cycle response status:', response.status);
    
    // Check if the response is ok
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error resetting cycle:', errorText);
      return false;
    }
    
    // Parse the JSON response
    const data = await response.json();
    console.log('Reset cycle response:', data);
    
    return true;
  } catch (error) {
    console.error('Error resetting cycle:', error);
    return false;
  }
};

export { fetchNextArticle, fetchCurrentCycleArticles, markArticleAsConsumed, resetCycle };
