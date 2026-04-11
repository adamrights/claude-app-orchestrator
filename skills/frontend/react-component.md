# React Component Scaffolding

## When to use
When creating new React components — pages, UI elements, or feature modules.

## Guidelines

- Use functional components with hooks exclusively.
- Co-locate related files: `ComponentName/index.tsx`, `ComponentName.test.tsx`, `ComponentName.module.css`.
- Props should be defined with a dedicated `interface` named `{ComponentName}Props`.
- Prefer composition over prop drilling — use context or state management for deeply shared state.
- Keep components under ~150 lines. Extract sub-components when complexity grows.

## Template

```tsx
import { type FC } from 'react';

interface ExampleProps {
  title: string;
  children: React.ReactNode;
}

const Example: FC<ExampleProps> = ({ title, children }) => {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
};

export default Example;
```

## Checklist
- [ ] Props interface defined and exported if needed externally
- [ ] Component has a clear, single responsibility
- [ ] Accessibility: semantic HTML, ARIA labels where needed
- [ ] Error and loading states handled
