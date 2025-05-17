import { fetchNextArticle, fetchCurrentCycleArticles, markArticleAsConsumed, resetCycle } from './dynamoDbService';

class ArticleService {
  constructor() {
    this.subscribers = new Set();
    this.articles = [];
    this.isPolling = false;
    this.pollInterval = 5000; // Poll every 5 seconds
    this.retryCount = 0;
    this.maxRetries = 3;
    this.cycleCount = 0;
    this.lastConsumedIndex = -1;
    this.totalArticles = 0;
  }

  async start() {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log('Article service starting...');
    
    // Fetch initial cycle articles
    try {
      const cycleArticles = await fetchCurrentCycleArticles();
      if (cycleArticles && cycleArticles.length > 0) {
        console.log(`Loaded ${cycleArticles.length} initial articles from current cycle`);
        this.articles = cycleArticles;
        
        // Notify subscribers
        this.notifySubscribers(false, false);
      }
    } catch (error) {
      console.error('Error fetching initial cycle articles:', error);
    }
    
    // Start polling for articles
    this.poll();
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
  
  async markCurrentArticleAsConsumed() {
    if (this.lastConsumedIndex >= 0) {
      console.log(`Marking article at index ${this.lastConsumedIndex} as consumed`);
      await markArticleAsConsumed(this.lastConsumedIndex);
    }
  }

  notifySubscribers(isNewArticle = false, isNewCycle = false, currentArticleId = null) {
    const metadata = {
      isNewArticle,
      isNewCycle,
      cycleCount: this.cycleCount,
      currentArticle: currentArticleId,
      totalArticles: this.totalArticles || this.articles.length
    };
    
    this.subscribers.forEach(callback => {
      console.log(`Notifying subscriber: ${isNewArticle ? 'new article' : 'update'}`);
      callback(this.articles, metadata);
    });
  }

  async poll() {
    console.log('Starting polling cycle');
    while (this.isPolling) {
      try {
        console.log('Polling for next article...');
        
        // Add exponential backoff for retries
        const backoffTime = Math.min(this.pollInterval * Math.pow(2, this.retryCount), 30000);
        
        // Fetch the next article from Lambda
        const data = await fetchNextArticle();
        
        if (!data || !data.article) {
          console.warn('No article received from poll');
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            console.error(`Max retries (${this.maxRetries}) exceeded. Stopping polling.`);
            this.stop();
            break;
          }
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        
        // Reset retry count on successful fetch
        this.retryCount = 0;
        
        const { article, metadata, cycleArticles } = data;
        
        // Update cycle count and total articles
        if (metadata) {
          this.cycleCount = metadata.cycleCount || 0;
          this.totalArticles = metadata.totalArticles || 0;
        }
        
        // Check if we have a new cycle
        const isNewCycle = metadata && metadata.isNewCycle;
        if (isNewCycle) {
          console.log(`New cycle detected: ${this.cycleCount}`);
        }
        
        // Use the cycle articles from the Lambda
        if (cycleArticles && cycleArticles.length > 0) {
          console.log(`Received ${cycleArticles.length} articles from current cycle`);
          this.articles = cycleArticles;
        }
        
        // Mark as consumed
        if (metadata && metadata.currentIndex !== undefined) {
          this.lastConsumedIndex = metadata.currentIndex;
          await this.markCurrentArticleAsConsumed();
        }
        
        // Notify subscribers
        this.notifySubscribers(true, isNewCycle, article.message_id);
      } catch (error) {
        console.error('Error polling for updates:', error);
        this.retryCount++;
        
        // Add exponential backoff for errors
        const backoffTime = Math.min(this.pollInterval * Math.pow(2, this.retryCount), 30000);
        
        if (this.retryCount > this.maxRetries) {
          console.error(`Max retries (${this.maxRetries}) exceeded. Stopping polling.`);
          this.stop();
          break;
        }
        
        // Wait longer between retries when errors occur
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue;
      }

      // Wait before next poll
      console.log(`Waiting ${this.pollInterval}ms before next poll`);
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }
  
  async resetCycle() {
    console.log('Resetting cycle');
    const success = await resetCycle();
    if (success) {
      this.articles = [];
      this.cycleCount = 0;
      
      // Notify subscribers of reset
      const metadata = {
        isNewArticle: false,
        isNewCycle: true,
        cycleCount: 0,
        currentArticle: null,
        isReset: true
      };
      
      this.subscribers.forEach(callback => {
        console.log('Notifying subscriber of cycle reset');
        callback(this.articles, metadata);
      });
      
      return true;
    }
    return false;
  }
}

// Create a singleton instance
const articleService = new ArticleService();

export default articleService; 