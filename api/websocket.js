import { fetchItemsWithValidUrls } from '../src/services/dynamoDbService';

let articles = [];
let currentIndex = 0;
let clients = new Set();

// Initialize articles
async function initializeArticles() {
  try {
    articles = await fetchItemsWithValidUrls();
    console.log(`Loaded ${articles.length} articles`);
  } catch (error) {
    console.error('Error initializing articles:', error);
  }
}

// Start the continuous cycle
async function startScraping() {
  if (articles.length === 0) {
    await initializeArticles();
  }

  while (true) {
    if (articles.length > 0) {
      const article = articles[currentIndex];
      const processedArticle = {
        ...article,
        publishedAt: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        }),
        publishTimestamp: new Date().getTime()
      };

      // Broadcast to all connected clients
      const message = JSON.stringify({
        type: 'newArticle',
        article: processedArticle
      });

      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

      // Move to next article
      currentIndex = (currentIndex + 1) % articles.length;
    }

    // Random delay between 5-45 seconds
    const delay = Math.floor(Math.random() * (45 - 5 + 1) + 5) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    // Upgrade the connection to WebSocket
    const { socket, head } = req;
    const ws = new WebSocket.Server({ noServer: true });

    ws.handleUpgrade(req, socket, head, (ws) => {
      clients.add(ws);
      console.log('Client connected');

      // Send initial articles
      if (articles.length > 0) {
        ws.send(JSON.stringify({
          type: 'initial',
          articles: articles
        }));
      }

      ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
      });
    });

    // Start scraping if not already running
    if (clients.size === 1) {
      startScraping();
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 