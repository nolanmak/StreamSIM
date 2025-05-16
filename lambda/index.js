const AWS = require('aws-sdk');

// Configure AWS - no need for explicit credentials as Lambda will use IAM role
AWS.config.update({
  region: 'us-east-1'
});

// Create DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table names
const MESSAGES_TABLE = 'IRAutomation-DataStorageStack-MessagesTable05B58A27-16054E0SDUCWI';
const STATE_TABLE = 'SimState';

// Configuration
const CYCLE_INTERVAL_MS = 15000; // 15 seconds between article updates
const MAX_RUNTIME_MS = 15 * 60 * 1000 - 5000; // 15 minutes minus 5 seconds buffer

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

// Create a response object with CORS headers for all origins
const createResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    },
    body: JSON.stringify(body)
  };
};

// Function to get items with valid URLs from DynamoDB
const getItemsWithValidUrls = async () => {
  try {
    const params = {
      TableName: MESSAGES_TABLE
    };
    
    const data = await dynamoDB.scan(params).promise();
    
    const itemsWithValidUrls = data.Items.filter(item => {
      return item.link && isValidUrl(item.link);
    });
    
    return itemsWithValidUrls;
  } catch (error) {
    console.error('Error fetching items from DynamoDB:', error);
    throw error;
  }
};

// Function to cycle a single article
const cycleOneArticle = async () => {
  try {
    // Get all articles
    const articles = await getItemsWithValidUrls();
    
    if (!articles || articles.length === 0) {
      console.log('No articles found');
      return { message: 'No articles found to cycle' };
    }

    // Get the current index from state table
    const getIndexParams = {
      TableName: STATE_TABLE,
      Key: { id: 'current' }
    };

    let currentIndex = 0;
    try {
      const stateData = await dynamoDB.get(getIndexParams).promise();
      if (stateData.Item) {
        currentIndex = (stateData.Item.currentIndex + 1) % articles.length;
      }
    } catch (error) {
      console.log('No state found or error reading state, starting from index 0:', error);
    }

    // Get the current article
    const currentArticle = articles[currentIndex];
    
    // Update the article with a new timestamp
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const updateParams = {
      TableName: MESSAGES_TABLE,
      Key: { message_id: currentArticle.message_id },
      UpdateExpression: 'SET publishedAt = :publishedAt, publishTimestamp = :publishTimestamp',
      ExpressionAttributeValues: {
        ':publishedAt': formattedTime,
        ':publishTimestamp': now.getTime()
      }
    };

    await dynamoDB.update(updateParams).promise();

    // Update the current index in the state table
    const updateStateParams = {
      TableName: STATE_TABLE,
      Key: { id: 'current' },
      UpdateExpression: 'SET currentIndex = :currentIndex',
      ExpressionAttributeValues: {
        ':currentIndex': currentIndex
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
            currentIndex: currentIndex
          }
        };
        await dynamoDB.put(putStateParams).promise();
      } else {
        throw error;
      }
    }

    console.log(`Updated article ${currentArticle.message_id} with new timestamp ${formattedTime}`);
    return {
      message: 'Article updated successfully',
      article: {
        message_id: currentArticle.message_id,
        title: currentArticle.title,
        publishedAt: formattedTime,
        publishTimestamp: now.getTime()
      },
      currentIndex: currentIndex,
      totalArticles: articles.length
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
      lastResult = await cycleOneArticle();
      cycleCount++;
      console.log(`Cycle #${cycleCount} complete. Waiting ${CYCLE_INTERVAL_MS}ms before next cycle.`);
      await sleep(CYCLE_INTERVAL_MS);
    } catch (error) {
      console.error('Error during cycle:', error);
      await sleep(5000); // Wait 5 seconds before retrying after an error
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
  console.log('Event:', JSON.stringify(event));
  
  try {
    // Handle direct Lambda test invocations (console test events)
    if (!event.path && !event.httpMethod) {
      console.log('Direct invocation detected - starting continuous cycling');
      // For direct invocations, run continuously until timeout
      const result = await continuousCycleArticles();
      return createResponse(200, result);
    }
    
    // Handle OPTIONS requests for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, {});
    }
    
    const path = event.path || '';
    const httpMethod = event.httpMethod || 'GET';
    console.log('Processing path:', path, 'with method:', httpMethod);
    
    // Health check endpoint
    if (path.endsWith('/health') && httpMethod === 'GET') {
      return createResponse(200, { status: 'ok' });
    }
    
    // Cycle articles endpoint - single cycle
    if (path.endsWith('/cycle') && httpMethod === 'POST') {
      const result = await cycleOneArticle();
      return createResponse(200, result);
    }
    
    // Continuous cycling endpoint
    if (path.endsWith('/continuous-cycle') && httpMethod === 'POST') {
      // Start continuous cycling in the background
      // Note: This will continue running even after the response is sent
      // Lambda will run until timeout or until the function completes
      continuousCycleArticles().catch(error => {
        console.error('Background cycling error:', error);
      });
      
      return createResponse(202, { 
        message: 'Continuous cycling started',
        info: 'Will run for up to 15 minutes or until Lambda timeout'
      });
    }
    
    // Default endpoint to get items with valid URLs
    if (httpMethod === 'GET') {
      console.log('Handling GET request, returning all valid links');
      const items = await getItemsWithValidUrls();
      return createResponse(200, items);
    }
    
    return createResponse(404, { error: 'Not Found' });
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
