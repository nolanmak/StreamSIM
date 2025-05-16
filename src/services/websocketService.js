import { fetchItemsWithValidUrls } from './dynamoDbService';

class WebSocketService {
  constructor() {
    this.subscribers = new Set();
    this.articles = [];
    this.currentIndex = 0;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial fetch
    try {
      this.articles = await fetchItemsWithValidUrls();
      console.log(`Loaded ${this.articles.length} articles`);
      
      // Start the continuous cycle
      this.cycleArticles();
    } catch (error) {
      console.error('Error starting WebSocket service:', error);
      this.isRunning = false;
    }
  }

  stop() {
    this.isRunning = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async cycleArticles() {
    while (this.isRunning) {
      if (this.articles.length > 0) {
        const article = this.articles[this.currentIndex];
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

        // Notify subscribers
        this.subscribers.forEach(callback => callback([processedArticle]));

        // Move to next article
        this.currentIndex = (this.currentIndex + 1) % this.articles.length;
      }

      // Random delay between 5-45 seconds
      const delay = Math.floor(Math.random() * (45 - 5 + 1) + 5) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();

export default websocketService; 