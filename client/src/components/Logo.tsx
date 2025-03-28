import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <div className={`logo-container flex flex-col items-center ${className}`}>
      <h1 
        className="text-[2.5rem] text-[#1C1C1C]"
        style={{ 
          fontFamily: 'Rozha One, serif',
          letterSpacing: '0.05em',
          lineHeight: '1'
        }}
      >
        Plan
      </h1>
    </div>
  );
};

export default Logo; 