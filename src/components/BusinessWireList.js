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

  useEffect(() => {
    const getInitialArticles = async () => {
      try {
        setLoading(true);
        const items = await fetchItemsWithValidUrls();
        setArticles(items);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching initial articles:', err);
        setError('Failed to load articles. Please try again later.');
        setLoading(false);
      }
    };

    getInitialArticles();

    // Subscribe to the article service
    const unsubscribe = articleService.subscribe((updatedArticles) => {
      setArticles(prevArticles => {
        const updated = [...prevArticles];
        updatedArticles.forEach(newArticle => {
          const index = updated.findIndex(a => a.message_id === newArticle.message_id);
          if (index >= 0) {
            updated[index] = newArticle;
          } else {
            updated.unshift(newArticle);
          }
        });
        return updated.sort((a, b) => b.publishTimestamp - a.publishTimestamp);
      });

      // Highlight new articles
      updatedArticles.forEach(article => {
        setNewArticleId(article.message_id);
        setTimeout(() => setNewArticleId(null), 5000);
      });
    });

    // Start the article service
    articleService.start();

    // Cleanup
    return () => {
      unsubscribe();
      articleService.stop();
    };
  }, []);

  // Calculate pagination
  const totalPages = Math.ceil(articles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentArticles = articles.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  if (loading) {
    return <div className="bw-loading">Loading latest news...</div>;
  }

  if (error) {
    return <div className="bw-error">{error}</div>;
  }

  if (articles.length === 0) {
    return <div className="bw-no-articles">No articles found.</div>;
  }

  return (
    <div className="bw-container">
      <div className="bw-header">
        <h1>Business Wire</h1>
        <p className="bw-tagline">Where Companies Get Their News Heard</p>
      </div>
      
      <div className="bw-content">
        {currentArticles.map((article) => (
          <div 
            key={article.message_id} 
            className={`relative py-6 lg:py-[34px] border-b-[1px] border-gray300 break-words ${article.message_id === newArticleId ? 'new-article' : ''}`}
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
              <span className="bw-date">{new Date().toLocaleDateString()}</span>
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
          Page {currentPage} of {totalPages}
        </span>
        <button 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="bw-pagination-button"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default BusinessWireList;
