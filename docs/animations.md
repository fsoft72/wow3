# WOW3 Animation System

A comprehensive CSS3 animation system for the WOW3 presentation software. The animations are atomic, composable, and optimized for performance using 3D-accelerated properties.

## Features

- **Atomic Animations**: Each animation can be used independently
- **Composable**: Multiple animations can be combined using bitwise operations
- **3D Accelerated**: All animations use hardware-accelerated CSS properties
- **Responsive**: Optimized for different screen sizes and respects user preferences
- **Performance Optimized**: Uses `will-change` and `transform3d` for optimal rendering

## Animation Types

The animation system supports the following base animation types, matching the specifications:

| Constant    | Value | CSS Class          | Description                                |
| ----------- | ----- | ------------------ | ------------------------------------------ |
| `FADE_IN`   | 1     | `.wow-fade-in`     | Element fades in from transparent          |
| `FADE_OUT`  | 2     | `.wow-fade-out`    | Element fades out to transparent           |
| `SLIDE_IN`  | 4     | `.wow-slide-in-*`  | Element slides in from specified direction |
| `SLIDE_OUT` | 8     | `.wow-slide-out-*` | Element slides out to specified direction  |
| `ZOOM_IN`   | 16    | `.wow-zoom-in`     | Element scales up while appearing          |
| `ZOOM_OUT`  | 32    | `.wow-zoom-out`    | Element scales down while disappearing     |

## Quick Start


### 2. Use CSS Classes Directly

```html
<!-- Basic usage -->
<div class="wow-animated wow-fade-in wow-duration-normal">
  Content that fades in
</div>

<!-- Slide animations with direction -->
<div class="wow-animated wow-slide-in-left wow-duration-slow">
  Content that slides in from left
</div>

<!-- Combined with utility classes -->
<div class="wow-animated wow-zoom-in wow-duration-fast wow-delay-2">
  Content that zooms in quickly after a delay
</div>
```

## Available Animations

### Basic Animations

#### Fade Animations

- `.wow-fade-in` - Fade in effect
- `.wow-fade-out` - Fade out effect

#### Slide Animations

- `.wow-slide-in-top` - Slide in from top
- `.wow-slide-in-bottom` - Slide in from bottom
- `.wow-slide-in-left` - Slide in from left
- `.wow-slide-in-right` - Slide in from right
- `.wow-slide-out-top` - Slide out to top
- `.wow-slide-out-bottom` - Slide out to bottom
- `.wow-slide-out-left` - Slide out to left
- `.wow-slide-out-right` - Slide out to right

#### Zoom Animations

- `.wow-zoom-in` - Zoom in effect
- `.wow-zoom-out` - Zoom out effect
- `.wow-zoom-in-up` - Zoom in while moving up
- `.wow-zoom-in-down` - Zoom in while moving down
- `.wow-zoom-out-up` - Zoom out while moving up
- `.wow-zoom-out-down` - Zoom out while moving down

### Advanced Animations

#### Flip Animations

- `.wow-flip-in-x` - Flip in around X-axis
- `.wow-flip-in-y` - Flip in around Y-axis
- `.wow-flip-out-x` - Flip out around X-axis
- `.wow-flip-out-y` - Flip out around Y-axis

#### Bounce and Elastic

- `.wow-bounce-in` - Bounce in with elastic effect
- `.wow-bounce-out` - Bounce out with elastic effect

#### Rotation

- `.wow-rotate-in` - Rotate in while appearing
- `.wow-rotate-out` - Rotate out while disappearing

## Utility Classes

### Duration Classes

- `.wow-duration-fast` - 0.3s duration
- `.wow-duration-normal` - 0.6s duration (default)
- `.wow-duration-slow` - 1s duration
- `.wow-duration-slower` - 1.5s duration
- `.wow-duration-slowest` - 2s duration

### Delay Classes

- `.wow-delay-1` to `.wow-delay-5` - 0.1s to 0.5s delays
- `.wow-delay-10` - 1s delay
- `.wow-delay-15` - 1.5s delay
- `.wow-delay-20` - 2s delay

### Easing Classes

- `.wow-ease-linear` - Linear timing
- `.wow-ease-in` - Ease in
- `.wow-ease-out` - Ease out
- `.wow-ease-in-out` - Ease in and out
- `.wow-ease-in-back` - Back ease in
- `.wow-ease-out-back` - Back ease out
- `.wow-ease-in-out-back` - Back ease in and out

## TypeScript API

### Animation Configuration

```typescript
interface Animation {
  type: number; // Combination of animation type constants
  duration: number; // Duration in milliseconds
  trigger: AnimationTrigger; // How the animation is triggered
}

enum AnimationTrigger {
  CLICK = "click", // Triggered by click
  AUTO = "auto", // Triggered automatically
}
```

### Animation Options

```typescript
interface AnimationOptions {
  direction?: SlideDirection; // For slide animations
  easing?: string; // Easing function
  delay?: number; // Delay in milliseconds
}

enum SlideDirection {
  TOP = "top",
  BOTTOM = "bottom",
  LEFT = "left",
  RIGHT = "right",
}
```

### Utility Functions

#### `applyAnimation(element, animation, options?)`

Applies an animation to a DOM element.

```typescript
applyAnimation(
  element,
  {
    type: AnimationType.FADE_IN | AnimationType.SLIDE_IN,
    duration: 800,
    trigger: AnimationTrigger.CLICK,
  },
  {
    direction: SlideDirection.LEFT,
    easing: "ease-out-back",
  }
);
```

#### `removeAnimation(element)`

Removes all animation classes from an element.

```typescript
removeAnimation(element);
```

#### `waitForAnimation(element)`

Returns a promise that resolves when the animation completes.

```typescript
await waitForAnimation(element);
console.log("Animation completed!");
```

#### `playAnimationSequence(animations, sequential?)`

Plays multiple animations either in sequence or parallel.

```typescript
await playAnimationSequence(
  [
    { element: element1, animation: fadeIn },
    { element: element2, animation: slideIn },
  ],
  true
); // Sequential
```

### Animation Presets

Pre-configured animations for common use cases:

```typescript
import { AnimationPresets } from "$lib/utils/animations.js";

// Quick fade in (300ms)
applyAnimation(element, AnimationPresets.quickFadeIn());

// Slide in with bounce (600ms)
applyAnimation(element, AnimationPresets.slideInBounce());

// Dramatic zoom in (800ms)
applyAnimation(element, AnimationPresets.dramaticZoomIn());

// Combined fade and zoom
applyAnimation(element, AnimationPresets.fadeZoomIn());
```

## Combining Animations

Animations can be combined using bitwise operations:

```typescript
// Fade in + Zoom in
const combined = AnimationType.FADE_IN | AnimationType.ZOOM_IN;

// Slide out + Fade out
const slideAndFade = AnimationType.SLIDE_OUT | AnimationType.FADE_OUT;

// Apply combined animation
applyAnimation(element, {
  type: combined,
  duration: 600,
  trigger: AnimationTrigger.CLICK,
});
```

## Best Practices

### Performance

1. Always use the `.wow-animated` base class
2. Prefer `transform3d` properties (automatically handled)
3. Use `will-change` for elements that will be animated (automatically applied)
4. Remove animation classes after use to free up resources

### Accessibility

- The system automatically respects `prefers-reduced-motion`
- On mobile devices, animations are automatically shortened for better performance
- Always provide fallback states for users with animations disabled

## Examples

### Basic Element Animation

```html
<div class="wow-animated wow-fade-in wow-duration-normal">
  This element fades in
</div>
```

### Slide Animation with Direction

```html
<div class="wow-animated wow-slide-in-left wow-duration-slow wow-delay-2">
  This slides in from the left after a delay
</div>
```

### Complex Combined Animation

```typescript
// Create a complex entry animation
const entryAnimation: Animation = {
  type: AnimationType.FADE_IN | AnimationType.ZOOM_IN | AnimationType.SLIDE_IN,
  duration: 1000,
  trigger: AnimationTrigger.AUTO,
};

applyAnimation(element, entryAnimation, {
  direction: SlideDirection.BOTTOM,
  easing: "ease-out-back",
  delay: 500,
});
```

### Animation Sequence

```typescript
// Animate multiple elements in sequence
const elements = document.querySelectorAll(".animate-me");
const animations = Array.from(elements).map((el, index) => ({
  element: el as HTMLElement,
  animation: {
    type: AnimationType.FADE_IN,
    duration: 400,
    trigger: AnimationTrigger.AUTO,
  },
  options: { delay: index * 100 }, // Staggered timing
}));

await playAnimationSequence(animations, false); // Parallel with staggered delays
```

## Browser Support

The animation system supports all modern browsers:

- Chrome 36+
- Firefox 16+
- Safari 9+
- Edge 12+

Graceful degradation is provided for older browsers through CSS fallbacks.

## Contributing

When adding new animations:

1. Use only 3D-accelerated properties (`transform3d`, `opacity`)
2. Include vendor prefixes where necessary
3. Follow the naming convention: `.wow-[animation-name]`
4. Add corresponding TypeScript utilities
5. Update documentation and examples
6. Test on multiple devices and browsers
