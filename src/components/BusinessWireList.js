import React, { useState, useEffect } from 'react';
import { fetchItemsWithValidUrls } from '../services/dynamoDbService';
import articleService from '../services/articleService';
import './BusinessWireList.css';

const ITEMS_PER_PAGE = 10;

const BusinessWireList = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newArticleId, setNewArticleId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMessage, setLoadingMessage] = useState('Loading latest news...');
  const [cycleCount, setCycleCount] = useState(0);

  useEffect(() => {
    console.log('BusinessWireList component mounted');
    
    const getInitialArticles = async (retryCount = 0) => {
      try {
        setLoading(true);
        setLoadingMessage('Fetching articles from API...');
        console.log('Fetching initial articles');
        
        const items = await fetchItemsWithValidUrls();
        console.log(`Received ${items?.length || 0} initial articles`);
        
        if (items && items.length > 0) {
          setArticles(items);
          setLoading(false);
        } else {
          console.warn('No initial articles received');
          setLoadingMessage('No articles found. Starting article service...');
          // We'll let the article service handle it
        }
      } catch (err) {
        console.error('Error fetching initial articles:', err);
        
        // Add retry logic with exponential backoff
        if (retryCount < 3) {
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
          console.log(`Retrying in ${backoffTime}ms (attempt ${retryCount + 1}/3)`);
          setLoadingMessage(`Connection issue. Retrying in ${Math.round(backoffTime/1000)} seconds...`);
          
          setTimeout(() => {
            getInitialArticles(retryCount + 1);
          }, backoffTime);
        } else {
          setError('Failed to load articles. Please refresh the page or try again later.');
          setLoading(false);
        }
      }
    };

    getInitialArticles();

    // Subscribe to the article service
    const unsubscribe = articleService.subscribe((updatedArticles, metadata) => {
      console.log(`Received ${updatedArticles.length} articles from service`);
      
      // Check if we've completed a cycle
      if (metadata && metadata.isNewCycle) {
        console.log('New cycle detected, resetting articles');
        setCycleCount(prev => prev + 1);
        setArticles(updatedArticles);
        return;
      }
      
      setArticles(prevArticles => {
        // Find the current article
        const currentArticle = updatedArticles.find(a => a.isCurrent);
        
        if (currentArticle) {
          // Highlight the current article
          setNewArticleId(currentArticle.message_id);
          setTimeout(() => setNewArticleId(null), 5000);
        }
        
        // If we have no articles yet, use all the updated articles
        if (prevArticles.length === 0) {
          return updatedArticles;
        }
        
        // Otherwise, update the articles with the new data
        const updated = [...prevArticles];
        updatedArticles.forEach(article => {
          const index = updated.findIndex(a => a.message_id === article.message_id);
          if (index >= 0) {
            updated[index] = article;
          } else {
            updated.push(article);
          }
        });
        
        // Sort by cycleIndex to maintain order
        const sorted = updated.sort((a, b) => {
          return (a.cycleIndex || 0) - (b.cycleIndex || 0);
        });
        
        console.log(`Total articles after update: ${sorted.length}`);
        
        // If we were in loading state and now have articles, exit loading state
        if (loading && sorted.length > 0) {
          setLoading(false);
        }
        
        return sorted;
      });
    });

    // Start the article service
    console.log('Starting article service');
    articleService.start();

    // Cleanup
    return () => {
      console.log('BusinessWireList component unmounting');
      unsubscribe();
      articleService.stop();
    };
  }, []);

  // Calculate pagination
  const totalPages = Math.ceil(articles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentArticles = articles.slice(startIndex, endIndex);

  // Calculate cycling progress
  const cycleProgress = articles.length > 0 ? 
    Math.round((articles.find(a => a.isCurrent)?.cycleIndex || 0) / articles.length * 100) : 0;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  if (loading) {
    return <div className="bw-loading">{loadingMessage}</div>;
  }

  if (error) {
    return <div className="bw-error">{error}</div>;
  }

  if (articles.length === 0) {
    return <div className="bw-no-articles">No articles found. Please check your connection and try again.</div>;
  }

  return (
    <div className="bw-container">
      <div className="bw-header">
        <h1>Business Wire</h1>
        <p className="bw-tagline">Where Companies Get Their News Heard</p>
        {articles.length > 0 && (
          <div className="bw-cycle-progress">
            <div className="bw-cycle-bar">
              <div 
                className="bw-cycle-fill" 
                style={{ width: `${cycleProgress}%` }}
                title={`Cycling progress: ${cycleProgress}%`}
              ></div>
            </div>
            <div className="bw-cycle-text">
              Cycle #{cycleCount} - Progress: {cycleProgress}% ({articles.find(a => a.isCurrent)?.cycleIndex || 0}/{articles.length})
            </div>
          </div>
        )}
      </div>
      
      <div className="bw-content">
        {currentArticles.map((article) => (
          <div 
            key={article.message_id} 
            className={`relative py-6 lg:py-[34px] border-b-[1px] border-gray300 break-words ${article.message_id === newArticleId ? 'new-article' : ''} ${article.isCurrent ? 'current-article' : ''}`}
          >
            <h2 className="text-primary">
              <a 
                href={article.link} 
                className="font-figtree"
                target="_blank" 
                rel="noopener noreferrer"
              >
                {article.title || 'Untitled Article'}
              </a>
            </h2>
            <div className="rich-text">
              <p>{article.description || 'No description available'}</p>
            </div>
            <div className="bw-metadata">
              <span className="bw-date">{new Date().toLocaleDateString('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}</span>
              <span className="bw-location">{article.location || 'NEW YORK'}</span>
              <span className="bw-published">Published at {article.publishedAt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="bw-pagination">
        <button 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="bw-pagination-button"
        >
          Previous
        </button>
        <span className="bw-pagination-info">
          Page {currentPage} of {totalPages || 1}
        </span>
        <button 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="bw-pagination-button"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default BusinessWireList;
