import { fetchItemsWithValidUrls } from './dynamoDbService';

class ArticleService {
  constructor() {
    this.subscribers = new Set();
    this.articles = [];
    this.isPolling = false;
    this.pollInterval = 5000; // Poll every 5 seconds
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async start() {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log('Article service starting...');
    // Initial fetch
    try {
      this.articles = await fetchItemsWithValidUrls();
      console.log(`Loaded ${this.articles.length} articles initially`);
      
      if (this.articles && this.articles.length > 0) {
        // Notify subscribers of initial articles
        this.subscribers.forEach(callback => callback(this.articles));
      } else {
        console.warn('No articles received from initial fetch');
      }
      
      // Start polling
      this.poll();
    } catch (error) {
      console.error('Error starting article service:', error);
      this.isPolling = false;
    }
  }

  stop() {
    console.log('Article service stopping');
    this.isPolling = false;
  }

  subscribe(callback) {
    console.log('New subscriber added to article service');
    this.subscribers.add(callback);
    return () => {
      console.log('Subscriber removed from article service');
      this.subscribers.delete(callback);
    };
  }

  async poll() {
    console.log('Starting polling cycle');
    while (this.isPolling) {
      try {
        console.log('Polling for new articles...');
        const newArticles = await fetchItemsWithValidUrls();
        console.log(`Received ${newArticles.length} articles from API`);
        
        if (!newArticles || newArticles.length === 0) {
          console.warn('No articles received from poll');
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            console.error(`Max retries (${this.maxRetries}) exceeded. Stopping polling.`);
            this.stop();
            break;
          }
          await new Promise(resolve => setTimeout(resolve, this.pollInterval));
          continue;
        }
        
        // Reset retry count on successful fetch
        this.retryCount = 0;
        
        // Find articles with new timestamps or new articles
        const updatedArticles = newArticles.filter(newArticle => {
          const existingArticle = this.articles.find(a => a.message_id === newArticle.message_id);
          const isNew = !existingArticle;
          const isUpdated = existingArticle && 
                           existingArticle.publishTimestamp !== newArticle.publishTimestamp;
          
          if (isNew) console.log(`Found new article: ${newArticle.message_id}`);
          if (isUpdated) console.log(`Updated article: ${newArticle.message_id}`);
          
          return isNew || isUpdated;
        });

        if (updatedArticles.length > 0) {
          console.log(`Found ${updatedArticles.length} updated articles`);
          
          // Update our local articles
          this.articles = newArticles;
          
          // Notify subscribers
          this.subscribers.forEach(callback => {
            console.log('Notifying subscriber of updates');
            callback(updatedArticles);
          });
        } else {
          console.log('No updated articles found');
        }
      } catch (error) {
        console.error('Error polling for updates:', error);
        this.retryCount++;
        if (this.retryCount > this.maxRetries) {
          console.error(`Max retries (${this.maxRetries}) exceeded. Stopping polling.`);
          this.stop();
          break;
        }
      }

      // Wait before next poll
      console.log(`Waiting ${this.pollInterval}ms before next poll`);
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }
}

// Create a singleton instance
const articleService = new ArticleService();

export default articleService; 