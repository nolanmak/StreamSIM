import React from 'react';
import './App.css';
import LinkList from './components/LinkList';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Stream Simulation</h1>
        <p>DynamoDB Link Viewer</p>
      </header>
      <main className="App-main">
        <LinkList />
      </main>
      <footer className="App-footer">
        <p>&copy; {new Date().getFullYear()} Stream Simulation</p>
      </footer>
    </div>
  );
}

export default App;
