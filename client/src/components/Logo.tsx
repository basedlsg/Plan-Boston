import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo oval */}
      <div className="w-14 h-20 relative mb-2">
        {/* Pink oval border */}
        <div className="absolute inset-0 bg-[#FC94C5] rounded-full" style={{ transform: 'scale(1.1)' }}></div>
        
        {/* Black oval interior */}
        <div className="absolute inset-0 bg-[#1C1C1C] rounded-full"></div>
        
        {/* Abstract pattern */}
        <svg 
          className="absolute inset-0 w-full h-full" 
          viewBox="0 0 100 100" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M30,20 Q40,10 60,30 Q80,50 50,70 Q20,90 40,50 Z" 
            fill="none" 
            stroke="#FC94C5" 
            strokeWidth="5"
          />
        </svg>
      </div>
      
      {/* Plan text */}
      <h1 className="text-3xl font-bold" style={{ fontFamily: "'Rozha One', serif" }}>Plan</h1>
    </div>
  );
};

export default Logo; 