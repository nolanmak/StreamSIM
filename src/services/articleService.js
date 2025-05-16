import { fetchItemsWithValidUrls } from './dynamoDbService';

class ArticleService {
  constructor() {
    this.subscribers = new Set();
    this.articles = [];
    this.isPolling = false;
    this.pollInterval = 5000; // Poll every 5 seconds
  }

  async start() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Initial fetch
    try {
      this.articles = await fetchItemsWithValidUrls();
      console.log(`Loaded ${this.articles.length} articles`);
      
      // Start polling
      this.poll();
    } catch (error) {
      console.error('Error starting article service:', error);
      this.isPolling = false;
    }
  }

  stop() {
    this.isPolling = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async poll() {
    while (this.isPolling) {
      try {
        const newArticles = await fetchItemsWithValidUrls();
        
        // Find articles with new timestamps
        const updatedArticles = newArticles.filter(newArticle => {
          const existingArticle = this.articles.find(a => a.message_id === newArticle.message_id);
          return !existingArticle || 
                 existingArticle.publishTimestamp !== newArticle.publishTimestamp;
        });

        if (updatedArticles.length > 0) {
          // Update our local articles
          this.articles = newArticles;
          
          // Notify subscribers
          this.subscribers.forEach(callback => callback(updatedArticles));
        }
      } catch (error) {
        console.error('Error polling for updates:', error);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }
}

// Create a singleton instance
const articleService = new ArticleService();

export default articleService; 