import { fetchItemsWithValidUrls, markArticleAsConsumed } from './dynamoDbService';

class ArticleService {
  constructor() {
    this.subscribers = new Set();
    this.articles = [];
    this.isPolling = false;
    this.pollInterval = 5000; // Poll every 5 seconds
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastCycleCount = 0;
    this.lastConsumedIndex = -1;
  }

  async start() {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log('Article service starting...');
    // Initial fetch
    try {
      const initialArticles = await fetchItemsWithValidUrls();
      console.log(`Loaded ${initialArticles.length} articles initially`);
      
      if (initialArticles && initialArticles.length > 0) {
        // Store all articles
        this.articles = initialArticles;
        
        // Find the current article and mark it as consumed
        const currentArticle = initialArticles.find(a => a.isCurrent);
        if (currentArticle && currentArticle.cycleIndex !== undefined) {
          this.lastConsumedIndex = currentArticle.cycleIndex;
          await this.markCurrentArticleAsConsumed();
        }
        
        // Notify subscribers of initial articles
        this.subscribers.forEach(callback => {
          const metadata = {
            isNewCycle: false,
            cycleCount: this.lastCycleCount,
            currentArticle: currentArticle ? currentArticle.message_id : null
          };
          callback(this.articles, metadata);
        });
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
  
  async markCurrentArticleAsConsumed() {
    if (this.lastConsumedIndex >= 0) {
      console.log(`Marking article at index ${this.lastConsumedIndex} as consumed`);
      await markArticleAsConsumed(this.lastConsumedIndex);
    }
  }

  async poll() {
    console.log('Starting polling cycle');
    while (this.isPolling) {
      try {
        console.log('Polling for new articles...');
        
        // Add exponential backoff for retries
        const backoffTime = Math.min(this.pollInterval * Math.pow(2, this.retryCount), 30000);
        
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
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        
        // Reset retry count on successful fetch
        this.retryCount = 0;
        
        // Find the current article
        const currentArticle = newArticles.find(a => a.isCurrent);
        const currentCycleCount = this.getCycleCount(newArticles);
        const isNewCycle = currentCycleCount > this.lastCycleCount;
        
        if (isNewCycle) {
          console.log(`New cycle detected: ${currentCycleCount}`);
          this.lastCycleCount = currentCycleCount;
          // We don't reset articles on new cycle anymore
        }
        
        // Check if the current article has changed
        if (currentArticle && 
            currentArticle.cycleIndex !== undefined && 
            currentArticle.cycleIndex !== this.lastConsumedIndex) {
          
          // Update our consumed index and mark as consumed
          this.lastConsumedIndex = currentArticle.cycleIndex;
          await this.markCurrentArticleAsConsumed();
          
          // Update our local articles with the current article
          this.updateCurrentArticle(currentArticle);
        }
        
        // Notify subscribers with metadata
        const metadata = {
          isNewCycle,
          cycleCount: currentCycleCount,
          currentArticle: currentArticle ? currentArticle.message_id : null
        };
        
        this.subscribers.forEach(callback => {
          console.log('Notifying subscriber of updates');
          callback(this.articles, metadata);
        });
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
  
  // Helper method to update the current article in our local articles array
  updateCurrentArticle(currentArticle) {
    // First, reset any previous current article
    this.articles = this.articles.map(article => ({
      ...article,
      isCurrent: false
    }));
    
    // Then update or add the new current article
    const index = this.articles.findIndex(a => a.message_id === currentArticle.message_id);
    if (index >= 0) {
      // Update existing article
      this.articles[index] = {
        ...this.articles[index],
        ...currentArticle,
        isCurrent: true
      };
    } else {
      // Add new article
      this.articles.push({
        ...currentArticle,
        isCurrent: true
      });
    }
  }
  
  // Helper to get the cycle count from articles
  getCycleCount(articles) {
    if (!articles || articles.length === 0) return 0;
    
    // Try to find an article with cycleCount property
    const currentArticle = articles.find(a => a.isCurrent);
    if (currentArticle && currentArticle.cycleCount !== undefined) {
      return currentArticle.cycleCount;
    }
    
    // If not found, check if first article has cycleIndex 0 and last article has a high index
    // This indicates we're at the start of a new cycle
    const firstArticle = articles[0];
    const lastArticle = articles[articles.length - 1];
    
    if (firstArticle && lastArticle && 
        firstArticle.cycleIndex === 0 && 
        lastArticle.cycleIndex === articles.length - 1) {
      return this.lastCycleCount + 1;
    }
    
    return this.lastCycleCount;
  }
}

// Create a singleton instance
const articleService = new ArticleService();

export default articleService; 