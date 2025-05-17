import React, { useState, useEffect } from 'react';
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
  const [totalArticles, setTotalArticles] = useState(0);

  useEffect(() => {
    console.log('BusinessWireList component mounted');
    
    // Subscribe to the article service
    const unsubscribe = articleService.subscribe((updatedArticles, metadata) => {
      console.log(`Received ${updatedArticles.length} articles from service`);
      console.log('Metadata:', metadata);
      
      // If this is a reset, clear the articles
      if (metadata && metadata.isReset) {
        console.log('Cycle reset detected, clearing articles');
        setArticles([]);
        setCycleCount(0);
        setTotalArticles(0);
        return;
      }
      
      // Check if we've completed a cycle
      if (metadata && metadata.isNewCycle) {
        console.log('New cycle detected, updating cycle count');
        setCycleCount(metadata.cycleCount || 0);
      }
      
      // Update total articles count if available
      if (metadata && metadata.totalArticles) {
        setTotalArticles(metadata.totalArticles);
      }
      
      // Highlight the current article if there is one
      if (metadata && metadata.currentArticle) {
        setNewArticleId(metadata.currentArticle);
        setTimeout(() => setNewArticleId(null), 5000);
      }
      
      // Articles are already sorted by the Lambda
      setArticles(updatedArticles);
      if (loading) {
        setLoading(false);
      }
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
  }, [loading]);

  // Find the current article
  const currentArticle = articles.find(a => a.isCurrent);
  
  // Calculate pagination
  const totalPages = Math.ceil(articles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentArticles = articles.slice(startIndex, endIndex);

  // Calculate cycling progress
  const cycleProgress = totalArticles > 0 ? 
    Math.round((currentArticle?.cycleIndex || 0) / totalArticles * 100) : 0;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleResetCycle = async () => {
    setLoading(true);
    setLoadingMessage('Resetting cycle...');
    await articleService.resetCycle();
    setCurrentPage(1);
    setLoading(false);
  };

  if (loading) {
    return <div className="bw-loading">{loadingMessage}</div>;
  }

  if (error) {
    return <div className="bw-error">{error}</div>;
  }

  if (articles.length === 0) {
    return (
      <div className="bw-no-articles">
        <p>No articles found. Waiting for articles to be published...</p>
        <div className="bw-loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="bw-container">
      <div className="bw-header">
        <h1>Business Wire</h1>
        <p className="bw-tagline">Where Companies Get Their News Heard</p>
        <div className="bw-controls">
          <button 
            onClick={handleResetCycle}
            className="bw-reset-button"
          >
            Reset Cycle
          </button>
        </div>
        {totalArticles > 0 && (
          <div className="bw-cycle-progress">
            <div className="bw-cycle-bar">
              <div 
                className="bw-cycle-fill" 
                style={{ width: `${cycleProgress}%` }}
                title={`Cycling progress: ${cycleProgress}%`}
              ></div>
            </div>
            <div className="bw-cycle-text">
              Cycle #{cycleCount} - Progress: {cycleProgress}% ({currentArticle?.cycleIndex || 0}/{totalArticles})
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
