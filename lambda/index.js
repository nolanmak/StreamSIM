const AWS = require('aws-sdk');

// Configure AWS - no need for explicit credentials as Lambda will use IAM role
AWS.config.update({
  region: 'us-east-1'
});

// Create DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table names
const TABLE_NAME = 'IRAutomation-DataStorageStack-MessagesTable05B58A27-16054E0SDUCWI';
const STATE_TABLE = 'SimState';  // Just the table name, not the ARN

// Configuration
const CYCLE_INTERVAL_MS = 15000; // 15 seconds between article updates
const MAX_RUNTIME_MS = 14 * 60 * 1000; // 14 minutes to safely avoid Lambda's 15-minute timeout
const MAX_WAIT_TIME_MS = 10000; // Maximum time to wait for app consumption (10 seconds)
const POLL_INTERVAL_MS = 1000; // How often to check if app has consumed the current article

// Helper function to validate URL
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    return false;
  }
};

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Format timestamp in Eastern Time
const formatTimeET = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\.\d+/, ''); // Remove milliseconds
};

// Create a response object with CORS headers for all origins
const createResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Allow any origin
      'Access-Control-Allow-Methods': '*', // Allow all methods
      'Access-Control-Allow-Headers': '*', // Allow all headers
      'Access-Control-Max-Age': '86400' // Cache preflight request for 24 hours
    },
    body: JSON.stringify(body)
  };
};

// Function to get items with valid URLs from DynamoDB
const getItemsWithValidUrls = async () => {
  try {
    // Scan the DynamoDB table
    const params = {
      TableName: TABLE_NAME
    };
    
    const data = await dynamoDB.scan(params).promise();
    
    // Filter items to only include those with valid URLs
    const itemsWithValidUrls = data.Items.filter(item => {
      return item.link && isValidUrl(item.link);
    });
    
    return itemsWithValidUrls;
  } catch (error) {
    console.error('Error fetching items from DynamoDB:', error);
    throw error;
  }
};

// Function to get the current state from DynamoDB
const getCurrentState = async () => {
  try {
    const params = {
      TableName: STATE_TABLE,
      Key: { id: 'current' }
    };
    
    const result = await dynamoDB.get(params).promise();
    if (!result.Item) {
      return {
        currentIndex: 0,
        cycleCount: 0,
        lastUpdated: Date.now(),
        articlesMap: {} // Initialize empty articles map
      };
    }
    
    return result.Item;
  } catch (error) {
    console.error('Error getting current state:', error);
    return {
      currentIndex: 0,
      cycleCount: 0,
      lastUpdated: Date.now(),
      articlesMap: {} // Initialize empty articles map
    };
  }
};

// Function to update the current state in DynamoDB
const updateCurrentState = async (state) => {
  try {
    const params = {
      TableName: STATE_TABLE,
      Item: {
        id: 'current',
        ...state,
        lastUpdated: Date.now()
      }
    };
    
    await dynamoDB.put(params).promise();
    return true;
  } catch (error) {
    console.error('Error updating current state:', error);
    return false;
  }
};

// Function to prepare an article with timestamp
const prepareArticleWithTimestamp = (article, index, totalArticles, now) => {
  return {
    ...article,
    publishTimestamp: now - ((totalArticles - index - 1) * 1000),
    publishedAt: formatTimeET(now - ((totalArticles - index - 1) * 1000)),
    cycleIndex: index,
    isCurrent: false // Will be set to true for the current article
  };
};

// Function to get the next article and maintain the articles map
const getNextArticle = async () => {
  try {
    // Get all articles with valid URLs
    const articles = await getItemsWithValidUrls();
    
    if (!articles || articles.length === 0) {
      console.log('No articles found');
      return { error: 'No articles found' };
    }
    
    // Get the current state with articles map
    const state = await getCurrentState();
    let { currentIndex, cycleCount, articlesMap = {} } = state;
    
    // Calculate the next index
    const prevIndex = currentIndex;
    currentIndex = (currentIndex + 1) % articles.length;
    
    // Check if we've completed a cycle
    let isNewCycle = false;
    if (currentIndex === 0 && prevIndex > 0) {
      cycleCount++;
      isNewCycle = true;
      console.log(`Completed cycle #${cycleCount}`);
    }
    
    // Get the current article
    const currentArticle = articles[currentIndex];
    const now = Date.now();
    
    // Initialize the current cycle in the map if it doesn't exist
    const cycleKey = `cycle_${cycleCount}`;
    if (!articlesMap[cycleKey]) {
      articlesMap[cycleKey] = {};
    }
    
    // Add the current article to the map if it's not already there
    if (!articlesMap[cycleKey][currentArticle.message_id]) {
      articlesMap[cycleKey][currentArticle.message_id] = prepareArticleWithTimestamp(
        currentArticle,
        currentIndex,
        articles.length,
        now
      );
    }
    
    // Get all articles for the current cycle
    const cycleArticles = Object.values(articlesMap[cycleKey]);
    
    // Mark the current article
    const currentArticleWithTimestamp = {
      ...articlesMap[cycleKey][currentArticle.message_id],
      isCurrent: true
    };
    
    // Update the article in the map
    articlesMap[cycleKey][currentArticle.message_id] = currentArticleWithTimestamp;
    
    // Update the state with the updated articles map
    await updateCurrentState({
      currentIndex,
      cycleCount,
      totalArticles: articles.length,
      articlesMap,
      lastConsumedIndex: currentIndex, // Automatically mark as consumed
      lastConsumedTimestamp: Date.now()
    });
    
    console.log(`Returning article ${currentIndex + 1} of ${articles.length}: ${currentArticle.message_id} (Cycle #${cycleCount})`);
    
    return {
      article: currentArticleWithTimestamp,
      metadata: {
        currentIndex,
        totalArticles: articles.length,
        cycleCount,
        isNewCycle
      },
      cycleArticles: cycleArticles.sort((a, b) => b.publishTimestamp - a.publishTimestamp) // Sort by timestamp, newest first
    };
  } catch (error) {
    console.error('Error getting next article:', error);
    throw error;
  }
};

// Function to get all articles for the current cycle
const getCurrentCycleArticles = async () => {
  try {
    // Get the current state with articles map
    const state = await getCurrentState();
    const { cycleCount, articlesMap = {} } = state;
    
    // Get the current cycle key
    const cycleKey = `cycle_${cycleCount}`;
    
    // Return empty array if no articles for this cycle yet
    if (!articlesMap[cycleKey]) {
      return [];
    }
    
    // Get all articles for the current cycle
    const cycleArticles = Object.values(articlesMap[cycleKey]);
    
    // Sort by timestamp, newest first
    return cycleArticles.sort((a, b) => b.publishTimestamp - a.publishTimestamp);
  } catch (error) {
    console.error('Error getting current cycle articles:', error);
    return [];
  }
};

// Lambda handler function
exports.handler = async (event) => {
  // Log the incoming event for debugging
  console.log('Event:', JSON.stringify(event));
  
  try {
    // Handle OPTIONS requests for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, {});
    }
    
    // Parse the path from the event
    const path = event.path || '';
    const httpMethod = event.httpMethod || 'GET';
    console.log('Processing path:', path, 'with method:', httpMethod);
    
    // Health check endpoint
    if (path.endsWith('/health') && httpMethod === 'GET') {
      return createResponse(200, { status: 'ok' });
    }
    
    // Get current cycle articles endpoint
    if (path === '/cycle-articles' && httpMethod === 'GET') {
      const cycleArticles = await getCurrentCycleArticles();
      return createResponse(200, { cycleArticles });
    }
    
    // Reset cycle endpoint
    if (path === '/reset' && httpMethod === 'POST') {
      try {
        await updateCurrentState({
          currentIndex: -1, // Will become 0 on next request
          cycleCount: 0,
          lastUpdated: Date.now(),
          articlesMap: {} // Clear the articles map
        });
        
        return createResponse(200, { success: true, message: 'Cycle reset successfully' });
      } catch (error) {
        console.error('Error resetting cycle:', error);
        return createResponse(500, { error: 'Failed to reset cycle' });
      }
    }
    
    // Default endpoint - get next article
    if (httpMethod === 'GET') {
      console.log('Getting next article');
      const result = await getNextArticle();
      return createResponse(200, result);
    }
    
    // Default response for unknown routes
    return createResponse(404, { error: 'Not Found' });
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(500, { error: 'Internal Server Error' });
  }
};