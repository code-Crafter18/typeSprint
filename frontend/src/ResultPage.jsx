import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import './ResultPage.css'; 

export function ResultPage() {
  const { state } = useLocation();
  
  const { wpm, accuracy, errors, graph_image } = state || { 
    wpm: 0, 
    accuracy: 0, 
    errors: 0, 
    graph_image: null 
  };

  return (
    <div className="results-container">
      
      <div className="results-screen">
        <h2>Test Complete!</h2>
        
        <div className="stats-horizontal">
          <div className="stat-item">
            <span className="stat-value">{wpm}</span>
            <span className="stat-label">WPM</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{accuracy}%</span>
            <span className="stat-label">Accuracy</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{errors}</span>
            <span className="stat-label">Errors</span>
          </div>
        </div>
        
        <div className="bottom-buttons">
          <Link to="/" className="test-button">
            Try Again
          </Link>
          <Link to="/" className="test-button">
            Next
          </Link>
        </div>
      </div>
      
      <div className="graph-screen">
        <h2>Your Progress</h2>
        
        {graph_image ? (
          <img src={graph_image} alt="Typing progress graph" />
        ) : null}
      </div>
    </div>
  );
}