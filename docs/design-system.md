# London Day Planner Design System

## Brand Identity
Our design system reflects a premium, elegant, and youthful aesthetic that appeals to modern travelers and professionals. The interface should feel sophisticated yet approachable, mixing minimalist design with thoughtful interactions.

## Color Palette

### Primary Colors
- Primary: `#2D3250` (Deep Navy)
- Secondary: `#7C73E6` (Soft Purple)
- Accent: `#FF6B6B` (Coral Pink)

### Neutral Palette
- Background: `#FFFFFF` (Pure White)
- Surface: `#F8F9FC` (Light Gray)
- Border: `#E2E8F0` (Soft Gray)

### Text Colors
- Primary Text: `#1A202C` (Dark Gray)
- Secondary Text: `#4A5568` (Medium Gray)
- Muted Text: `#718096` (Light Gray)

### Semantic Colors
- Success: `#48BB78` (Green)
- Warning: `#ECC94B` (Yellow)
- Error: `#F56565` (Red)
- Info: `#4299E1` (Blue)

## Typography

### Font Families
- Primary: Inter
- Headings: Montserrat
- Monospace: JetBrains Mono (for time displays)

### Font Sizes
- xs: 0.75rem (12px)
- sm: 0.875rem (14px)
- base: 1rem (16px)
- lg: 1.125rem (18px)
- xl: 1.25rem (20px)
- 2xl: 1.5rem (24px)
- 3xl: 1.875rem (30px)
- 4xl: 2.25rem (36px)

### Font Weights
- Light: 300
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

## Spacing System
Using a 4-point grid system:
- xs: 0.25rem (4px)
- sm: 0.5rem (8px)
- base: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)
- 3xl: 4rem (64px)

## Component Styling

### Buttons
- Border Radius: 0.5rem (8px)
- Height: 2.5rem (40px)
- Padding: 0.75rem 1.5rem
- Transition: 150ms ease

States:
- Default: Solid background
- Hover: Slight brightness increase (105%)
- Active: Slight brightness decrease (95%)
- Disabled: 40% opacity

### Input Fields
- Border Radius: 0.5rem (8px)
- Height: 2.75rem (44px)
- Border: 1px solid border color
- Background: White
- Padding: 0.75rem 1rem

States:
- Focus: 2px ring in primary color
- Error: Red border and error message
- Disabled: Light gray background

### Cards
- Border Radius: 1rem (16px)
- Border: 1px solid border color
- Shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- Background: White
- Padding: 1.5rem

### Timeline Items
- Connector Line: 2px solid border color
- Icon Background: Primary color at 10% opacity
- Icon Color: Primary color
- Spacing between items: 1.5rem

## Layout Guidelines

### Grid System
- 12-column grid
- Maximum width: 1280px
- Gutter width: 2rem
- Column gap: 1rem

### Breakpoints
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

### Container Padding
- Mobile: 1rem
- Tablet: 2rem
- Desktop: 4rem

## Micro-interactions

### Transitions
- Duration: 150ms
- Timing Function: ease
- Properties: opacity, transform, background-color

### Hover Effects
- Scale: 1.02
- Shadow increase
- Color brightness adjustment

### Loading States
- Skeleton loading for content
- Subtle pulse animation
- Progress indicators for actions

## Best Practices

### Accessibility
- Minimum contrast ratio: 4.5:1
- Focus indicators always visible
- Interactive elements: minimum 44x44px touch target
- Proper heading hierarchy

### Responsive Design
- Mobile-first approach
- Fluid typography
- Flexible grid system
- Adaptive spacing

### Visual Hierarchy
- Clear section separation
- Consistent spacing
- Visual weight distribution
- Strategic use of color and typography

### Performance
- Optimize transitions
- Lazy load images
- Minimize layout shifts
- Efficient animation techniques
