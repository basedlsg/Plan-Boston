import React from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

const Logo: React.FC<LogoProps> = ({ className = '', style = {} }) => {
  return (
    <div className={`logo-container flex flex-col items-center ${className}`} style={style}>
      <h1 
        className="text-[5rem] text-[#1C1C1C]"
        style={{ 
          fontFamily: 'Rozha One, serif',
          letterSpacing: '0.05em',
          lineHeight: '1',
          fontSize: '5rem', // Explicitly set font size in both places
          fontWeight: 'bold'
        }}
      >
        Plan
      </h1>
    </div>
  );
};

export default Logo; 