# Layout System Documentation

## Grid System

Our layout system uses a modern, flexible grid that adapts to different screen sizes while maintaining consistent spacing and alignment.

### Base Grid
- 12-column system
- Fluid gutters (min: 16px, max: 24px)
- Maximum content width: 1280px
- Responsive breakpoints with smooth transitions

### Spacing Scale
```
xs: 0.25rem (4px)
sm: 0.5rem (8px)
md: 1rem (16px)
lg: 1.5rem (24px)
xl: 2rem (32px)
2xl: 3rem (48px)
3xl: 4rem (64px)
```

## Page Layouts

### Home Page
```
|- Header (full width)
|- Hero Section (centered, max-width)
|- Plan Form (card layout)
  |- Date/Time Selection
  |- Plan Description
  |- Submit Button
|- Itinerary Display
  |- Timeline
  |- Activity Cards
|- Footer
```

### Responsive Behavior
- Mobile: Single column, stacked layout
- Tablet: Two column where appropriate
- Desktop: Full grid utilization
- Wide: Maximum width with balanced margins

## Container System

### Default Container
- Centered content
- Responsive padding
- Maximum width constraint
- Smooth scaling

```css
.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;
  padding-right: 1rem;
  max-width: 1280px;
}

@media (min-width: 640px) {
  .container {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}
```

### Container Variants
1. Narrow
   - Max-width: 768px
   - Centered content
   - Ideal for forms

2. Wide
   - Max-width: 1536px
   - Full-width sections
   - Hero areas

3. Full Bleed
   - No max-width
   - Edge-to-edge content
   - Background elements

## Spacing Guidelines

### Vertical Rhythm
- Consistent spacing between sections
- Proportional margins and padding
- Clear visual hierarchy

### Component Spacing
- Card padding: 1.5rem
- Section margins: 2rem
- Form field gaps: 1rem

## Responsive Design

### Breakpoints
```
sm: 640px  (Mobile landscape)
md: 768px  (Tablet)
lg: 1024px (Desktop)
xl: 1280px (Wide desktop)
2xl: 1536px (Extra wide)
```

### Mobile First
- Base styles for mobile
- Progressive enhancement
- Fluid typography
- Flexible layouts

### Touch Targets
- Minimum size: 44x44px
- Adequate spacing
- Clear feedback states

## Animation Guidelines

### Page Transitions
- Smooth fade-in
- Content slide-up
- Progressive loading

### Component Animations
- Subtle scale on hover
- Smooth color transitions
- Loading states

## Best Practices

1. Consistency
- Use standard spacing
- Maintain alignment
- Follow grid system

2. Accessibility
- Logical tab order
- Keyboard navigation
- Screen reader flow

3. Performance
- Minimize layout shifts
- Optimize for paint
- Reduce reflows

4. Responsive Testing
- Test all breakpoints
- Verify touch interactions
- Check content flow
