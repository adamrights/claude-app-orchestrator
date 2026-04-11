# Styling in React

## When to use
When applying styles to React components.

## Approach Comparison

| Approach | Pros | Cons | Best for |
|----------|------|------|----------|
| CSS Modules | Scoped, zero runtime, standard CSS | Separate files | Most projects |
| Tailwind CSS | Fast iteration, design system built-in | Verbose classnames | Rapid prototyping, design-system-heavy apps |
| styled-components | Co-located, dynamic styles | Runtime cost, bundle size | Themed component libraries |
| Vanilla CSS/SCSS | Simple, no tooling | Global scope collisions | Small projects |

## Tailwind CSS Patterns

```tsx
// Compose utilities clearly — group by concern
<button
  className={clsx(
    'rounded-lg px-4 py-2 font-medium',       // layout & typography
    'bg-blue-600 text-white hover:bg-blue-700', // color
    'focus:outline-none focus:ring-2',           // accessibility
    disabled && 'opacity-50 cursor-not-allowed'  // state
  )}
>
  Submit
</button>
```

## CSS Modules Pattern

```tsx
import styles from './Button.module.css';

const Button = ({ variant = 'primary', children }) => (
  <button className={`${styles.button} ${styles[variant]}`}>
    {children}
  </button>
);
```

## Guidelines
- Pick one primary approach per project and be consistent.
- Use CSS custom properties for theming (light/dark mode).
- Avoid inline styles except for truly dynamic values (e.g., computed positions).
- Responsive design: mobile-first with `min-width` breakpoints.
