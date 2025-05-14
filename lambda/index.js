const AWS = require('aws-sdk');

// Configure AWS - no need for explicit credentials as Lambda will use IAM role
AWS.config.update({
  region: 'us-east-1'
});

// Create DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table name from the ARN
const TABLE_NAME = 'IRAutomation-DataStorageStack-MessagesTable05B58A27-16054E0SDUCWI';

// Helper function to validate URL
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    return false;
  }
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

// Lambda handler function
exports.handler = async (event) => {
  // Log the incoming event for debugging
  console.log('Event:', JSON.stringify(event));
  
  try {
    // Handle direct Lambda test invocations (console test events)
    if (!event.path && !event.httpMethod) {
      console.log('Direct invocation detected - returning all valid links');
      const items = await getItemsWithValidUrls();
      return createResponse(200, items);
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
    
    // API endpoint to get items with valid URLs - handle any path
    // For API Gateway, just respond to any GET request with the data
    if (httpMethod === 'GET') {
      console.log('Handling GET request, returning all valid links');
      const items = await getItemsWithValidUrls();
      return createResponse(200, items);
    }
    
    // Default response for unknown routes
    return createResponse(404, { error: 'Not Found' });
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
