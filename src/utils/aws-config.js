import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// IMPORTANT: Client-side access to AWS services is NOT secure!
// For a production application, you should use a backend service or AWS Amplify
// to handle DynamoDB access securely.

// Initialize the DynamoDB client
const client = new DynamoDBClient({
  region: "us-east-1"
  // Credentials should NOT be included here for client-side code
  // as they would be visible to anyone using your application
});

// Create a document client for easier handling of JavaScript objects
const docClient = DynamoDBDocumentClient.from(client);

// Table name from the ARN
const TABLE_NAME = "IRAutomation-DataStorageStack-MessagesTable05B58A27-16054E0SDUCWI";

export { docClient, TABLE_NAME, ScanCommand };
