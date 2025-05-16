import { fetchItemsWithValidUrls } from './dynamoDbService';

class ScrapingSimulator {
  constructor() {
    this.subscribers = new Set();
    this.isRunning = false;
    this.articles = [];
    this.currentIndex = 0;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Initial fetch
    const items = await fetchItemsWithValidUrls();
    this.articles = items;
    
    // Start the simulation loop
    this.simulateScraping();
  }

  stop() {
    this.isRunning = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async simulateScraping() {
    while (this.isRunning) {
      try {
        if (this.articles.length === 0) {
          const items = await fetchItemsWithValidUrls();
          this.articles = items;
        }

        // Get the next article in the cycle
        const article = this.articles[this.currentIndex];
        
        // Process the article with timestamp
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

        // Notify subscribers of the new article
        this.subscribers.forEach(callback => callback([processedArticle]));
        
        // Move to the next article, cycling back to the start if needed
        this.currentIndex = (this.currentIndex + 1) % this.articles.length;

        // Random delay between 5-45 seconds
        const delay = Math.floor(Math.random() * (45 - 5 + 1) + 5) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error('Error in scraping simulation:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Create a singleton instance
const scrapingSimulator = new ScrapingSimulator();

export default scrapingSimulator; 