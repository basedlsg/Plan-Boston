import React from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

const Logo: React.FC<LogoProps> = ({ className = '', style = {} }) => {
  return (
    <div className={`logo-container flex flex-col items-center ${className}`} style={style}>
      <h1 
        className="text-[4.5rem] text-[#1C1C1C]"
        style={{ 
          fontFamily: 'Rozha One, serif',
          letterSpacing: 'normal',
          lineHeight: '1',
          fontSize: '4.5rem', // Explicitly set font size in both places
          fontWeight: 'normal' // Changed from 'bold' to 'normal'
        }}
      >
        Plan
      </h1>
    </div>
  );
};

export default Logo; 