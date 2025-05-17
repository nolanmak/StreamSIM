import { fetchItemsWithValidUrls, markArticleAsConsumed, fetchCurrentArticle } from './dynamoDbService';

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
    this.seenArticleIds = new Set(); // Track which articles we've seen
  }

  async start() {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log('Article service starting...');
    // Initial fetch to get all articles for context
    try {
      const { articles: initialArticles } = await fetchItemsWithValidUrls();
      console.log(`Loaded ${initialArticles.length} articles initially for context`);
      
      // We don't store all articles anymore, we'll build up our list as we go
      this.articles = [];
      this.seenArticleIds.clear();
      
      // Start polling for articles
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

  // Sort articles by timestamp, newest first
  sortArticles(articles) {
    return [...articles].sort((a, b) => {
      // Sort by publishTimestamp (newest first)
      return (b.publishTimestamp || 0) - (a.publishTimestamp || 0);
    });
  }

  async poll() {
    console.log('Starting polling cycle');
    while (this.isPolling) {
      try {
        console.log('Polling for articles...');
        
        // Add exponential backoff for retries
        const backoffTime = Math.min(this.pollInterval * Math.pow(2, this.retryCount), 30000);
        
        // Fetch articles - the Lambda will now automatically cycle to the next article
        const { articles, cycleInfo } = await fetchItemsWithValidUrls();
        
        if (!articles || articles.length === 0) {
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
        
        // Process the articles
        let isNewCycle = false;
        let currentArticle = null;
        
        // If we have cycle info, use it
        if (cycleInfo) {
          console.log('Received cycle info:', cycleInfo);
          
          // Check for cycle count change
          isNewCycle = cycleInfo.isNewCycle || (cycleInfo.cycleCount > this.lastCycleCount);
          if (isNewCycle) {
            console.log(`New cycle detected: ${cycleInfo.cycleCount}`);
            this.lastCycleCount = cycleInfo.cycleCount;
          }
          
          // Find the current article
          currentArticle = articles.find(a => a.cycleIndex === cycleInfo.currentIndex);
          if (currentArticle) {
            console.log(`Current article is: ${currentArticle.message_id}`);
            
            // Mark as consumed
            this.lastConsumedIndex = cycleInfo.currentIndex;
            await this.markCurrentArticleAsConsumed();
          }
        }
        
        // Process each article
        for (const article of articles) {
          // Check if this is a new article we haven't seen before
          const isNewArticle = !this.seenArticleIds.has(article.message_id);
          
          if (isNewArticle) {
            console.log(`New article found: ${article.message_id}`);
            
            // Add to our seen articles set
            this.seenArticleIds.add(article.message_id);
            
            // Add to our articles array if not already there
            if (!this.articles.some(a => a.message_id === article.message_id)) {
              this.articles.push(article);
            }
          }
        }
        
        // Sort articles by timestamp, newest first
        const sortedArticles = this.sortArticles(this.articles);
        
        // Notify subscribers
        const metadata = {
          isNewArticle: true,
          isNewCycle,
          cycleCount: this.lastCycleCount,
          currentArticle: currentArticle?.message_id
        };
        
        this.subscribers.forEach(callback => {
          console.log('Notifying subscriber of updated articles');
          callback(sortedArticles, metadata);
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
  
  // Helper to get the cycle count from articles
  getCycleCount(article) {
    if (!article) return 0;
    return article.cycleCount || 0;
  }
}

// Create a singleton instance
const articleService = new ArticleService();

export default articleService; 