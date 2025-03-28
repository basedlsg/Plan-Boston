import React, { useEffect, useRef } from 'react';
import '../styles/ProductShowcase.css';

interface ProductCardProps {
  name: string;
  tagline: string;
  status: 'Released' | 'Coming Soon';
  color: 'purple' | 'blue' | 'green';
  features: string[];
  delay: number;
}

const ProductCard: React.FC<ProductCardProps> = ({
  name,
  tagline,
  status,
  color,
  features,
  delay
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              entry.target.classList.add('visible');
            }, delay);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [delay]);

  // Generate random positions for condensation droplets
  const droplets = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    scale: 0.5 + Math.random() * 0.5,
    delay: Math.random() * 5
  }));

  const getColorClass = () => {
    switch (color) {
      case 'purple': return 'bg-purple-glow';
      case 'blue': return 'bg-blue-glow';
      case 'green': return 'bg-green-glow';
      default: return 'bg-purple-glow';
    }
  };

  const getBorderClass = () => {
    switch (color) {
      case 'purple': return 'border-purple';
      case 'blue': return 'border-blue';
      case 'green': return 'border-green';
      default: return 'border-purple';
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`product-card ${getColorClass()} animate-card opacity-0`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Glass effect overlay */}
      <div className="glass-effect">
        {/* Condensation droplets */}
        {droplets.map(droplet => (
          <div 
            key={droplet.id}
            className="droplet"
            style={{
              top: droplet.top,
              left: droplet.left,
              transform: `scale(${droplet.scale})`,
              animationDelay: `${droplet.delay}s`
            }}
          />
        ))}
      </div>
      
      {/* Status badge */}
      <div className={`status-badge ${status === 'Released' ? 'released' : 'coming-soon'}`}>
        {status}
      </div>
      
      {/* Product content */}
      <div className="product-content">
        <h3 className="product-name">{name}</h3>
        <p className="product-tagline">{tagline}</p>
        
        <div className={`divider ${getBorderClass()}`}></div>
        
        <ul className="feature-list">
          {features.map((feature, index) => (
            <li key={index} className="feature-item">
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ProductShowcase: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    
    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  const products = [
    {
      name: "Transformation",
      tagline: "Language Alchemization Engine",
      status: "Released" as const,
      color: "purple" as const,
      features: [
        "Text → Code Transmutation",
        "Visual Alchemy Formulas",
        "Live Preview Crucible",
        "Export options"
      ],
      delay: 0
    },
    {
      name: "Distillation",
      tagline: "Goal Actualization Reactor",
      status: "Coming Soon" as const,
      color: "blue" as const,
      features: [
        "Desire → Actionable Reality",
        "AI Sigil Generator",
        "Mentor Daemons",
        "Oath Binding System"
      ],
      delay: 150
    },
    {
      name: "Projection",
      tagline: "Reality Simulation Forge",
      status: "Coming Soon" as const,
      color: "green" as const,
      features: [
        "Manifestation → Validation",
        "Chronos Integration",
        "Holographic Council",
        "Artifact Genesis Engine"
      ],
      delay: 300
    },
    {
      name: "Culmination",
      tagline: "Actualization Observatory",
      status: "Coming Soon" as const,
      color: "purple" as const,
      features: [
        "Potential → Tangible",
        "Prosperity Lens",
        "Trophy Hall",
        "Dominion Simulator"
      ],
      delay: 450
    }
  ];

  return (
    <section className="product-showcase">
      <div className="container">
        <h2 ref={sectionRef} className="section-title opacity-0">
          Digital Alchemy Tools
        </h2>
        
        <div className="product-grid">
          {products.map((product, index) => (
            <ProductCard
              key={product.name}
              name={product.name}
              tagline={product.tagline}
              status={product.status}
              color={product.color}
              features={product.features}
              delay={product.delay}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductShowcase;