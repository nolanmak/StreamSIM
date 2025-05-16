import React, { useState, useEffect } from 'react';
import { fetchItemsWithValidUrls } from '../services/dynamoDbService';
import './BusinessWireList.css';

const BusinessWireList = () => {
  const [allArticles, setAllArticles] = useState([]);
  const [displayedArticles, setDisplayedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newArticleId, setNewArticleId] = useState(null);

  useEffect(() => {
    const getArticles = async () => {
      try {
        setLoading(true);
        const items = await fetchItemsWithValidUrls();
        setAllArticles(items);
        
        // Initially display only the first 5 articles with timestamps
        if (items && items.length > 0) {
          // Add timestamps with a slight offset to ensure proper ordering
          const initialArticles = items.slice(0, 5).map((article, idx) => {
            const now = new Date();
            // Offset by a few seconds to create a natural order
            const timestamp = now.getTime() - ((5 - idx) * 1000);
            const publishDate = new Date(timestamp);
            return {
              ...article,
              publishedAt: publishDate.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
              }),
              publishTimestamp: timestamp
            };
          });
          
          // Sort by publish timestamp (newest first)
          const sortedArticles = initialArticles.sort((a, b) => b.publishTimestamp - a.publishTimestamp);
          setDisplayedArticles(sortedArticles);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching articles:', err);
        setError('Failed to load articles. Please try again later.');
        setLoading(false);
      }
    };

    getArticles();
  }, []);
  
  // Effect to gradually publish remaining articles at random intervals
  useEffect(() => {
    if (!loading && allArticles.length > 5) {
      const remainingArticles = [...allArticles.slice(5)];
      
      const publishArticle = (index) => {
        if (index >= remainingArticles.length) return;
        
        const randomInterval = Math.floor(Math.random() * (45 - 5 + 1) + 5) * 1000; // Between 5-45 seconds
        
        setTimeout(() => {
          // Add timestamp to the article being published
          const now = new Date();
          const articleWithTimestamp = {
            ...remainingArticles[index],
            publishedAt: now.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              fractionalSecondDigits: 3
            }),
            publishTimestamp: now.getTime() // Store timestamp for sorting
          };
          
          // Add the new article and sort by publish timestamp (newest first)
          setDisplayedArticles(prev => {
            const updated = [articleWithTimestamp, ...prev];
            return updated.sort((a, b) => (b.publishTimestamp || 0) - (a.publishTimestamp || 0));
          });
          
          // Set the new article ID to highlight it
          setNewArticleId(remainingArticles[index].message_id);
          
          // Remove highlight after 5 seconds
          setTimeout(() => {
            setNewArticleId(null);
          }, 5000);
          
          // Schedule next article publication
          publishArticle(index + 1);
        }, randomInterval);
        
        console.log(`Next article will be published in ${randomInterval/1000} seconds`);
      };
      
      // Start publishing process
      publishArticle(0);
    }
  }, [loading, allArticles]);

  if (loading) {
    return <div className="bw-loading">Loading latest news...</div>;
  }

  if (error) {
    return <div className="bw-error">{error}</div>;
  }

  if (displayedArticles.length === 0) {
    return <div className="bw-no-articles">No articles found.</div>;
  }

  return (
    <div className="bw-container">
      <div className="bw-header">
        <h1>Business Wire</h1>
        <p className="bw-tagline">Where Companies Get Their News Heard</p>
      </div>
      
      <div className="bw-content">
        {displayedArticles.map((article) => (
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
    </div>
  );
};

export default BusinessWireList;
