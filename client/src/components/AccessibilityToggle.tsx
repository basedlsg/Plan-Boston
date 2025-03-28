import React, { useState } from 'react';
import { Eye, ZoomIn, ZoomOut, Glasses, RefreshCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccessibilityStore, ContrastMode, VisualImpairmentType } from '@/lib/accessibilityContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export function AccessibilityToggle() {
  const [open, setOpen] = useState(false);
  const { 
    contrastMode, 
    setContrastMode, 
    visualImpairment, 
    setVisualImpairment,
    fontSizeMultiplier,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    reduceMotion,
    toggleReduceMotion
  } = useAccessibilityStore();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full relative"
          aria-label="Accessibility options"
        >
          <Glasses className="h-[1.2rem] w-[1.2rem]" />
          {(contrastMode !== 'normal' || visualImpairment !== 'none' || fontSizeMultiplier > 1 || reduceMotion) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-blue rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Accessibility Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Contrast Mode */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="mr-2">🌗</span>
            <span>Contrast Mode</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup 
              value={contrastMode} 
              onValueChange={(value) => setContrastMode(value as ContrastMode)}
            >
              <DropdownMenuRadioItem value="normal">Normal Contrast</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="high">High Contrast</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="highest">Highest Contrast</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        
        {/* Vision Simulation */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="mr-2">👁️</span>
            <span>Vision Simulation</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup 
              value={visualImpairment} 
              onValueChange={(value) => setVisualImpairment(value as VisualImpairmentType)}
            >
              <DropdownMenuRadioItem value="none">Normal Vision</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs opacity-70">Color Blindness</DropdownMenuLabel>
              <DropdownMenuRadioItem value="protanopia">
                Protanopia (Red-Blind)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="deuteranopia">
                Deuteranopia (Green-Blind)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="tritanopia">
                Tritanopia (Blue-Blind)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="achromatopsia">
                Achromatopsia (No Color)
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs opacity-70">Vision Challenges</DropdownMenuLabel>
              <DropdownMenuRadioItem value="blurredVision">
                Blurred Vision
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="cataracts">
                Cataracts
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        
        <DropdownMenuSeparator />
        
        {/* Text Size Controls */}
        <DropdownMenuItem className="flex justify-between">
          <div className="flex items-center">
            <span className="mr-2">🔤</span>
            <span>Text Size</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={(e) => {
                e.preventDefault();
                decreaseFontSize();
              }}
              disabled={fontSizeMultiplier <= 1}
            >
              <ZoomOut className="h-3 w-3" />
              <span className="sr-only">Decrease text size</span>
            </Button>
            <span className="text-xs w-8 text-center">
              {Math.round(fontSizeMultiplier * 100)}%
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={(e) => {
                e.preventDefault();
                increaseFontSize();
              }}
              disabled={fontSizeMultiplier >= 1.5}
            >
              <ZoomIn className="h-3 w-3" />
              <span className="sr-only">Increase text size</span>
            </Button>
          </div>
        </DropdownMenuItem>
        
        {/* Motion Toggle */}
        <DropdownMenuItem 
          className="flex items-center justify-between"
          onClick={(e) => {
            e.preventDefault();
            toggleReduceMotion();
          }}
        >
          <div className="flex items-center">
            <span className="mr-2">🔄</span>
            <span>Reduce Motion</span>
          </div>
          <div className={`h-4 w-8 rounded-full ${reduceMotion ? 'bg-brand-blue' : 'bg-gray-300'} relative transition-colors`}>
            <div 
              className={`absolute top-0.5 ${reduceMotion ? 'right-0.5' : 'left-0.5'} h-3 w-3 rounded-full bg-white transition-all`}
            />
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Reset All Settings */}
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            setContrastMode('normal');
            setVisualImpairment('none');
            resetFontSize();
            if (reduceMotion) toggleReduceMotion();
          }}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          <span>Reset All Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}