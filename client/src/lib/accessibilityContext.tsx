import React, { createContext, useContext, useState, useEffect } from 'react';
import { create } from 'zustand';

// Define the visual impairment simulation types
export type VisualImpairmentType = 
  | 'none' 
  | 'protanopia' // Red-green color blindness (red deficient)
  | 'deuteranopia' // Red-green color blindness (green deficient)
  | 'tritanopia' // Blue-yellow color blindness
  | 'achromatopsia' // Complete color blindness
  | 'blurredVision' // Low vision simulation
  | 'cataracts'; // Cataract simulation

// Define the contrast modes
export type ContrastMode = 'normal' | 'high' | 'highest';

// Define the Accessibility Store type
interface AccessibilityStore {
  // Current contrast mode
  contrastMode: ContrastMode;
  setContrastMode: (mode: ContrastMode) => void;
  
  // Current visual impairment simulation
  visualImpairment: VisualImpairmentType;
  setVisualImpairment: (type: VisualImpairmentType) => void;
  
  // Font size adjustment (1 = normal, >1 = larger)
  fontSizeMultiplier: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  
  // Motion reduction
  reduceMotion: boolean;
  toggleReduceMotion: () => void;
}

// Create the accessibility store with Zustand
export const useAccessibilityStore = create<AccessibilityStore>((set) => ({
  // Default to normal contrast
  contrastMode: 'normal',
  setContrastMode: (mode) => {
    // Update body class for CSS targeting
    document.body.classList.remove('contrast-normal', 'contrast-high', 'contrast-highest');
    document.body.classList.add(`contrast-${mode}`);
    
    set({ contrastMode: mode });
    localStorage.setItem('a11y-contrast', mode);
  },
  
  // Default to no visual impairment simulation
  visualImpairment: 'none',
  setVisualImpairment: (type) => {
    document.body.classList.remove(
      'vision-none', 
      'vision-protanopia', 
      'vision-deuteranopia',
      'vision-tritanopia',
      'vision-achromatopsia',
      'vision-blurredVision',
      'vision-cataracts'
    );
    document.body.classList.add(`vision-${type}`);
    
    set({ visualImpairment: type });
    localStorage.setItem('a11y-vision', type);
  },
  
  // Font size adjustment
  fontSizeMultiplier: 1,
  increaseFontSize: () => 
    set((state) => {
      const newSize = Math.min(state.fontSizeMultiplier + 0.1, 1.5);
      document.documentElement.style.setProperty('--font-size-multiplier', `${newSize}`);
      localStorage.setItem('a11y-font-size', `${newSize}`);
      return { fontSizeMultiplier: newSize };
    }),
  decreaseFontSize: () => 
    set((state) => {
      const newSize = Math.max(state.fontSizeMultiplier - 0.1, 1);
      document.documentElement.style.setProperty('--font-size-multiplier', `${newSize}`);
      localStorage.setItem('a11y-font-size', `${newSize}`);
      return { fontSizeMultiplier: newSize };
    }),
  resetFontSize: () => {
    document.documentElement.style.setProperty('--font-size-multiplier', '1');
    localStorage.setItem('a11y-font-size', '1');
    return set({ fontSizeMultiplier: 1 });
  },
  
  // Motion reduction
  reduceMotion: false,
  toggleReduceMotion: () => 
    set((state) => {
      const newValue = !state.reduceMotion;
      document.body.classList.toggle('reduce-motion', newValue);
      localStorage.setItem('a11y-reduce-motion', newValue ? 'true' : 'false');
      return { reduceMotion: newValue };
    }),
}));

// Create an accessibility provider component to initialize settings from localStorage
export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    setContrastMode,
    setVisualImpairment,
    increaseFontSize,
    decreaseFontSize,
    toggleReduceMotion
  } = useAccessibilityStore();
  
  useEffect(() => {
    // Initialize contrast mode from localStorage
    const savedContrastMode = localStorage.getItem('a11y-contrast') as ContrastMode | null;
    if (savedContrastMode) {
      setContrastMode(savedContrastMode);
    } else if (window.matchMedia('(prefers-contrast: high)').matches) {
      // Use system preference if available
      setContrastMode('high');
    }
    
    // Initialize visual impairment from localStorage
    const savedVision = localStorage.getItem('a11y-vision') as VisualImpairmentType | null;
    if (savedVision) {
      setVisualImpairment(savedVision);
    }
    
    // Initialize font size from localStorage
    const savedFontSize = localStorage.getItem('a11y-font-size');
    if (savedFontSize) {
      const size = parseFloat(savedFontSize);
      document.documentElement.style.setProperty('--font-size-multiplier', savedFontSize);
      // Apply font size adjustments until we reach the saved value
      const currentSize = 1;
      if (size > currentSize) {
        for (let i = 0; i < Math.round((size - currentSize) * 10); i++) {
          increaseFontSize();
        }
      } else if (size < currentSize) {
        for (let i = 0; i < Math.round((currentSize - size) * 10); i++) {
          decreaseFontSize();
        }
      }
    } else {
      document.documentElement.style.setProperty('--font-size-multiplier', '1');
    }
    
    // Initialize motion preference from localStorage
    const savedMotion = localStorage.getItem('a11y-reduce-motion');
    if (savedMotion === 'true' || 
        (savedMotion === null && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      toggleReduceMotion();
    }
  }, []);
  
  return <>{children}</>;
};