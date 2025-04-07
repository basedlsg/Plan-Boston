import React from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

const Logo: React.FC<LogoProps> = ({ className = '', style = {} }) => {
  return (
    <div className={`logo-container flex flex-col items-center ${className}`} style={style}>
      <div className="flex flex-col items-center">
        <h1 
          className="text-[3.8rem] text-[#1C1C1C]"
          style={{ 
            fontFamily: 'Rozha One, serif',
            letterSpacing: 'normal',
            lineHeight: '0.9',
            fontWeight: 'normal'
          }}
        >
          Planyourperfectday
        </h1>
        <div 
          className="text-[2rem] text-[#17B9E6] font-medium mt-1"
          style={{
            fontFamily: 'Poppins, sans-serif',
            letterSpacing: '0.05em'
          }}
        >
          .app/London
        </div>
      </div>
    </div>
  );
};

export default Logo; 