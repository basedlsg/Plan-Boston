import React from 'react';
import Logo from './Logo';

const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-container">
      <Logo className="mb-8" />
      <div className="loading-indicator" />
      <p className="loading-text" style={{ 
        fontFamily: 'var(--font-button)',
        color: 'var(--color-primary)',
        marginTop: 'var(--spacing-md)'
      }}>
        Plan Your Perfect Days in Seconds
      </p>
    </div>
  );
};

export default LoadingScreen; 