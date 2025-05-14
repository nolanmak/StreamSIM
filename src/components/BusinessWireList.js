import React, { useState, useEffect } from 'react';
import { fetchItemsWithValidUrls } from '../services/dynamoDbService';
import './BusinessWireList.css';

const BusinessWireList = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getArticles = async () => {
      try {
        setLoading(true);
        const items = await fetchItemsWithValidUrls();
        setArticles(items);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching articles:', err);
        setError('Failed to load articles. Please try again later.');
        setLoading(false);
      }
    };

    getArticles();
  }, []);

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
        {articles.map((article) => (
          <div 
            key={article.message_id} 
            className="relative py-6 lg:py-[34px] border-b-[1px] border-gray300 break-words"
          >
            <h2 className="text-primary">
              <a 
                href={`https://www.businesswire.com${article.link}`} 
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessWireList;
