import React, { useState, useEffect } from 'react';
import { fetchItemsWithValidUrls } from '../services/dynamoDbService';

const LinkList = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getLinks = async () => {
      try {
        setLoading(true);
        const items = await fetchItemsWithValidUrls();
        setLinks(items);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching links:', err);
        setError('Failed to load links. Please try again later.');
        setLoading(false);
      }
    };

    getLinks();
  }, []);

  if (loading) {
    return <div className="loading">Loading links...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (links.length === 0) {
    return <div className="no-links">No valid links found.</div>;
  }

  return (
    <div className="link-list-container">
      <h2>Links from DynamoDB</h2>
      <ul className="link-list">
        {links.map((item) => (
          <li key={item.message_id} className="link-item">
            <a 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {item.title || item.link}
            </a>
            {item.description && (
              <p className="description">{item.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LinkList;
