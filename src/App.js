import React, { useState } from 'react';
import './App.css';
import BusinessWireList from './components/BusinessWireList';
import DynamicHead from './components/DynamicHead';
import { fetchNextArticle, fetchCurrentCycleArticles } from './services/dynamoDbService';

function App() {
  const [debugInfo, setDebugInfo] = useState(null);
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  const testApi = async () => {
    try {
      setDebugInfo('Testing API connection...');
      
      // Fetch next article
      const nextArticleData = await fetchNextArticle();
      
      // Fetch cycle articles
      const cycleArticles = await fetchCurrentCycleArticles();
      
      setDebugInfo(
        `Next article: 
        ${nextArticleData.article ? JSON.stringify(nextArticleData.article.message_id, null, 2) : 'None'}
        
        Metadata: 
        ${nextArticleData.metadata ? JSON.stringify(nextArticleData.metadata, null, 2) : 'None'}
        
        Cycle Articles: 
        ${cycleArticles.length} articles in current cycle`
      );
    } catch (error) {
      setDebugInfo(`API Error: ${error.message}`);
    }
  };

  const toggleDebug = () => {
    setIsDebugVisible(!isDebugVisible);
  };

  return (
    <div className="App">
      <DynamicHead />
      
      <button 
        onClick={toggleDebug}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '5px 10px',
          background: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        Debug
      </button>
      
      {isDebugVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '50px',
            right: '10px',
            width: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            padding: '10px',
            zIndex: 1000,
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}
        >
          <button onClick={testApi}>Test API</button>
          <div style={{ marginTop: '10px' }}>
            {debugInfo}
          </div>
        </div>
      )}
      
      <main className="App-main">
        <BusinessWireList />
      </main>
      <footer className="App-footer">
        <p>&copy; {new Date().getFullYear()} Business Wire Simulation</p>
      </footer>
    </div>
  );
}

export default App;
