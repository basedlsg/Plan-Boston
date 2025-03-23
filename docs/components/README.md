# Component Library Documentation

This document outlines the core components used in the London Day Planner application, their variants, and usage guidelines.

## Form Components

### DateTimePicker
A premium date and time selection component that allows users to specify when their day plan should start.

Styling:
- Clean, minimal calendar interface
- Smooth dropdown animations
- Clear visual feedback for selected dates
- Integrated time selection with 12/24 hour toggle

Usage:
```jsx
<DateTimePicker
  label="Start Time"
  value={startTime}
  onChange={handleTimeChange}
  minTime="09:00"
  maxTime="22:00"
/>
```

### QueryTextarea
An enhanced textarea for plan descriptions with intelligent suggestions.

Styling:
- Generous padding and line height
- Smooth resize animation
- Character count indicator
- Smart placeholder text

## Content Components

### ItineraryTimeline
A sophisticated timeline view of the planned activities.

Styling:
- Vertical line connector with gradient
- Activity cards with hover effects
- Travel time indicators with icons
- Smooth entrance animations

### ActivityCard
Displays individual activities within the itinerary.

Variants:
- Standard (museum, gallery, etc.)
- Dining (restaurants, cafes)
- Entertainment (theater, music)
- Transit (walking, transport)

## Feedback Components

### LoadingState
Elegant loading indicators for various states.

Variants:
- Skeleton loading for content
- Progress bar for submissions
- Spinner for quick actions

### Toast Notifications
Informative toast messages for user feedback.

Styling:
- Minimal design
- Smooth entrance/exit
- Status icons
- Progress indicator

## Navigation Components

### Header
Main navigation component with branding.

Styling:
- Clean, minimal design
- Subtle background blur
- Responsive navigation
- Smooth transitions

### ActionButton
Primary interaction buttons throughout the app.

Variants:
- Primary (solid)
- Secondary (outline)
- Tertiary (ghost)
- Icon button

## Layout Components

### Container
Main layout wrapper maintaining consistent spacing.

Usage:
```jsx
<Container size="md" className="py-8">
  {children}
</Container>
```

### Grid
Flexible grid system for responsive layouts.

Variants:
- 1-column (mobile)
- 2-column (tablet)
- 3-column (desktop)
- 4-column (wide)

## Best Practices

1. Component Consistency
- Use consistent spacing
- Maintain component hierarchy
- Follow established patterns

2. Responsive Behavior
- Test all breakpoints
- Ensure touch targets
- Maintain readability

3. Performance
- Lazy load when possible
- Optimize animations
- Minimize rerenders

4. Accessibility
- Maintain ARIA labels
- Keyboard navigation
- Screen reader support
