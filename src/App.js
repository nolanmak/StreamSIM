import React from 'react';
import './App.css';
import BusinessWireList from './components/BusinessWireList';

function App() {
  return (
    <div className="App">
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
