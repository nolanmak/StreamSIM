# Stream Simulation Lambda Function

This AWS Lambda function securely accesses DynamoDB to fetch items with valid URLs and serves them through an API Gateway endpoint.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│  React App  │────▶│ API Gateway │────▶│   Lambda    │────▶│ DynamoDB │
│             │     │             │     │             │     │          │
└─────────────┘     └─────────────┘     └─────────────┘     └──────────┘
```

## Deployment Instructions

### Prerequisites

1. Install the AWS CLI and configure it with your credentials:
   ```
   aws configure
   ```

2. Install the AWS SAM CLI for serverless deployments:
   ```
   brew install aws-sam-cli
   ```

### Deploy with AWS SAM

1. Build the SAM application:
   ```
   sam build -t template.yaml
   ```

2. Deploy the application:
   ```
   sam deploy --guided
   ```
   - Follow the prompts to configure your deployment
   - When asked for stack name, you can use "stream-simulation-stack"
   - Accept the default values for most options

3. After deployment, SAM will output the API Gateway endpoint URL. Update your React application to use this URL.

### Manual Deployment

If you prefer to deploy manually:

1. Install dependencies:
   ```
   npm install
   ```

2. Create a deployment package:
   ```
   npm run build
   ```

3. Create the Lambda function (first time only):
   ```
   aws lambda create-function \
     --function-name stream-simulation-function \
     --runtime nodejs18.x \
     --role arn:aws:iam::<YOUR-ACCOUNT-ID>:role/lambda-dynamodb-role \
     --handler index.handler \
     --zip-file fileb://deployment.zip
   ```

4. Update the Lambda function (subsequent deployments):
   ```
   npm run deploy
   ```

## IAM Permissions

Your Lambda function needs the following permissions:
- `dynamodb:Scan` on the DynamoDB table

Create an IAM role with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:699328772264:table/IRAutomation-DataStorageStack-MessagesTable05B58A27-16054E0SDUCWI"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```
