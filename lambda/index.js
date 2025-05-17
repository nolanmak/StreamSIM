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
const AUTO_CYCLE = true; // Flag to enable auto-cycling on main endpoint calls

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

// Function to get or create timestamps for articles
const getOrCreateTimestamps = async (articles) => {
  try {
    // Get the timestamp table data
    const params = {
      TableName: STATE_TABLE,
      Key: { id: 'timestamps' }
    };
    
    let timestampData = {};
    
    try {
      const result = await dynamoDB.get(params).promise();
      if (result.Item && result.Item.timestamps) {
        timestampData = result.Item.timestamps;
      }
    } catch (error) {
      console.log('No timestamp data found, will create new timestamps');
    }
    
    const now = Date.now();
    const updatedTimestamps = { ...timestampData };
    
    // Add timestamps to each article
    const articlesWithTimestamps = articles.map((article, index) => {
      // Use existing timestamp or create new one
      if (!updatedTimestamps[article.message_id]) {
        updatedTimestamps[article.message_id] = {
          publishTimestamp: now - (index * 1000), // Stagger timestamps by 1 second
          cycleIndex: index
        };
      }
      
      const timestamp = updatedTimestamps[article.message_id];
      
      return {
        ...article,
        publishTimestamp: timestamp.publishTimestamp,
        publishedAt: formatTimeET(timestamp.publishTimestamp),
        cycleIndex: index, // Always update the cycle index
        isCurrent: false // Default to false, will be updated for current article
      };
    });
    
    // Save the updated timestamps
    try {
      await dynamoDB.put({
        TableName: STATE_TABLE,
        Item: {
          id: 'timestamps',
          timestamps: updatedTimestamps
        }
      }).promise();
    } catch (error) {
      console.error('Error saving timestamps:', error);
    }
    
    return articlesWithTimestamps;
  } catch (error) {
    console.error('Error handling timestamps:', error);
    // Return original articles if there's an error
    return articles.map((article, index) => ({
      ...article,
      cycleIndex: index
    }));
  }
};

// Function to check if the app has consumed the current article
const checkAppConsumption = async (currentIndex) => {
  try {
    const params = {
      TableName: STATE_TABLE,
      Key: { id: 'app_state' }
    };
    
    const result = await dynamoDB.get(params).promise();
    if (result.Item && result.Item.lastConsumedIndex === currentIndex) {
      console.log(`App has consumed article at index ${currentIndex}`);
      return true;
    }
    
    console.log(`App has not yet consumed article at index ${currentIndex}`);
    return false;
  } catch (error) {
    console.error('Error checking app consumption:', error);
    return false; // Assume not consumed on error
  }
};

// Function to wait for app consumption with timeout
const waitForAppConsumption = async (currentIndex) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
    if (await checkAppConsumption(currentIndex)) {
      return true;
    }
    
    // Wait before checking again
    await sleep(POLL_INTERVAL_MS);
  }
  
  console.log(`Timeout waiting for app consumption of index ${currentIndex}`);
  return false; // Timed out
};

// Function to cycle a single article
const cycleOneArticle = async (waitForConsumption = false) => {
  try {
    // Get all articles
    let articles = await getItemsWithValidUrls();
    
    if (!articles || articles.length === 0) {
      console.log('No articles found');
      return { message: 'No articles found to cycle' };
    }
    
    // Add timestamps to articles
    articles = await getOrCreateTimestamps(articles);
    
    // Get the current index from state table
    const getIndexParams = {
      TableName: STATE_TABLE,
      Key: { id: 'current' }
    };

    let currentIndex = 0;
    let cycleCount = 0;
    let isNewCycle = false;
    let prevIndex = -1;
    
    try {
      const stateData = await dynamoDB.get(getIndexParams).promise();
      if (stateData.Item) {
        // Store previous index for consumption check
        prevIndex = stateData.Item.currentIndex || 0;
        
        // Increment index and wrap around if we reach the end
        currentIndex = (prevIndex + 1) % articles.length;
        cycleCount = stateData.Item.cycleCount || 0;
        
        // Detect if we've completed a cycle
        if (currentIndex === 0 && prevIndex > 0) {
          cycleCount++;
          isNewCycle = true;
          console.log(`Completed cycle #${cycleCount}`);
        }
      }
    } catch (error) {
      console.log('No state found or error reading state, starting from index 0:', error);
    }
    
    // If we're waiting for consumption and this isn't the first article,
    // wait for the app to consume the previous article
    if (waitForConsumption && prevIndex >= 0) {
      console.log(`Waiting for app to consume article at index ${prevIndex}`);
      const consumed = await waitForAppConsumption(prevIndex);
      if (!consumed) {
        console.log('Proceeding anyway after timeout');
      }
    }

    // Get the current article
    const currentArticle = articles[currentIndex];
    currentArticle.isCurrent = true; // Mark this as the current article
    
    // Log which article is being processed
    console.log(`Processing article ${currentIndex + 1} of ${articles.length}: ${currentArticle.message_id} (Cycle #${cycleCount})`);

    // Update the current index in the state table
    const updateStateParams = {
      TableName: STATE_TABLE,
      Key: { id: 'current' },
      UpdateExpression: 'SET currentIndex = :currentIndex, cycleCount = :cycleCount, lastUpdated = :lastUpdated',
      ExpressionAttributeValues: {
        ':currentIndex': currentIndex,
        ':cycleCount': cycleCount,
        ':lastUpdated': Date.now()
      }
    };

    try {
      await dynamoDB.update(updateStateParams).promise();
    } catch (error) {
      // If the item doesn't exist yet, create it
      if (error.code === 'ValidationException') {
        const putStateParams = {
          TableName: STATE_TABLE,
          Item: {
            id: 'current',
            currentIndex: currentIndex,
            cycleCount: cycleCount,
            lastUpdated: Date.now()
          }
        };
        await dynamoDB.put(putStateParams).promise();
      } else {
        throw error;
      }
    }

    console.log(`Updated state for article ${currentArticle.message_id}`);
    return {
      message: 'State updated successfully',
      article: currentArticle,
      currentIndex: currentIndex,
      totalArticles: articles.length,
      cycleCount: cycleCount,
      isNewCycle: isNewCycle,
      allArticles: articles
    };
  } catch (error) {
    console.error('Error cycling articles:', error);
    throw error;
  }
};

// Function to continuously cycle articles until timeout
const continuousCycleArticles = async () => {
  const startTime = Date.now();
  let cycleCount = 0;
  let lastResult = null;
  
  console.log('Starting continuous article cycling');
  
  while (Date.now() - startTime < MAX_RUNTIME_MS) {
    try {
      // Pass true to wait for app consumption
      lastResult = await cycleOneArticle(true);
      cycleCount++;
      console.log(`Cycle #${cycleCount} complete. Waiting for app consumption before next cycle.`);
    } catch (error) {
      console.error('Error during cycle:', error);
      await sleep(5000); // Still keep sleep for error recovery
    }
  }
  
  console.log(`Continuous cycling complete. Ran ${cycleCount} cycles in ${(Date.now() - startTime) / 1000} seconds`);
  return {
    message: 'Continuous cycling complete',
    cycleCount,
    runTime: `${(Date.now() - startTime) / 1000} seconds`,
    lastResult
  };
};

// Lambda handler function
exports.handler = async (event) => {
  // Log the incoming event for debugging
  console.log('Event:', JSON.stringify(event));
  
  try {
    // Special command for continuous cycling
    if (event.source === 'continuous-cycle-command') {
      console.log('Continuous cycle command detected');
      return await continuousCycleArticles();
    }
    
    // Handle direct Lambda test invocations (console test events)
    if (!event.path && !event.httpMethod) {
      console.log('Direct invocation detected - returning all valid links');
      const items = await getItemsWithValidUrls();
      const itemsWithTimestamps = await getOrCreateTimestamps(items);
      return createResponse(200, itemsWithTimestamps);
    }
    
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
    
    // Get current article endpoint
    if (path === '/current' && httpMethod === 'GET') {
      console.log('Getting current article');
      try {
        // Get the current index
        const stateParams = {
          TableName: STATE_TABLE,
          Key: { id: 'current' }
        };
        
        const stateData = await dynamoDB.get(stateParams).promise();
        if (!stateData.Item) {
          return createResponse(404, { error: 'No current article found' });
        }
        
        const currentIndex = stateData.Item.currentIndex;
        
        // Get all articles and find the current one
        const items = await getItemsWithValidUrls();
        const articlesWithTimestamps = await getOrCreateTimestamps(items);
        
        if (currentIndex >= articlesWithTimestamps.length) {
          return createResponse(404, { error: 'Current article index out of bounds' });
        }
        
        // Mark the current article
        const currentArticle = articlesWithTimestamps[currentIndex];
        currentArticle.isCurrent = true;
        
        console.log(`Returning current article: ${currentArticle.message_id}`);
        return createResponse(200, currentArticle);
      } catch (error) {
        console.error('Error getting current article:', error);
        return createResponse(500, { error: 'Failed to get current article' });
      }
    }
    
    // Mark article as consumed endpoint
    if (path === '/consumed' && httpMethod === 'POST') {
      try {
        // Parse the request body
        const body = event.body ? JSON.parse(event.body) : {};
        const { index } = body;
        
        if (index === undefined) {
          return createResponse(400, { error: 'Missing index parameter' });
        }
        
        // Update the app state in DynamoDB
        await dynamoDB.put({
          TableName: STATE_TABLE,
          Item: {
            id: 'app_state',
            lastConsumedIndex: index,
            timestamp: Date.now()
          }
        }).promise();
        
        console.log(`App marked article at index ${index} as consumed`);
        return createResponse(200, { success: true, consumedIndex: index });
      } catch (error) {
        console.error('Error marking article as consumed:', error);
        return createResponse(500, { error: 'Failed to mark article as consumed' });
      }
    }
    
    // Cycle endpoint
    if (path === '/cycle' && httpMethod === 'POST') {
      console.log('Cycling one article');
      const result = await cycleOneArticle();
      return createResponse(200, result);
    }
    
    // API endpoint to get items with valid URLs - handle any path
    // For API Gateway, just respond to any GET request with the data
    if (httpMethod === 'GET') {
      console.log('Handling GET request for all valid links');
      
      // If AUTO_CYCLE is enabled, cycle to the next article before returning
      let cycleResult = null;
      if (AUTO_CYCLE) {
        console.log('Auto-cycling to next article before returning data');
        try {
          cycleResult = await cycleOneArticle(true); // Wait for app consumption
        } catch (error) {
          console.error('Error during auto-cycling:', error);
          // Continue even if cycling fails
        }
      }
      
      const items = await getItemsWithValidUrls();
      const articlesWithTimestamps = await getOrCreateTimestamps(items);
      
      // If we have cycle results, include them in the response
      const response = {
        articles: articlesWithTimestamps
      };
      
      if (cycleResult) {
        response.cycleResult = {
          currentIndex: cycleResult.currentIndex,
          cycleCount: cycleResult.cycleCount,
          isNewCycle: cycleResult.isNewCycle
        };
      }
      
      return createResponse(200, response);
    }
    
    // Default response for unknown routes
    return createResponse(404, { error: 'Not Found' });
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(500, { error: 'Internal Server Error' });
  }
};