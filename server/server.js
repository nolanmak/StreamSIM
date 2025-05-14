const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
require('dotenv').config();
const app = express();
const port = 3001;

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  // Credentials will be loaded from environment variables or ~/.aws/credentials
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
});

// Create DynamoDB document client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table name from the ARN
const TABLE_NAME = 'IRAutomation-DataStorageStack-MessagesTable05B58A27-16054E0SDUCWI';

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to validate URL
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (error) {
    return false;
  }
};

// API endpoint to get items with valid URLs
app.get('/api/links', async (req, res) => {
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
    
    res.json(itemsWithValidUrls);
  } catch (error) {
    console.error('Error fetching items from DynamoDB:', error);
    res.status(500).json({ error: 'Failed to fetch items from DynamoDB' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
