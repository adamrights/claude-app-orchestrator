---
tags: [accessibility, a11y, aria, semantic-html, keyboard, screen-reader]
---

# Accessibility

## When to use
Always. Accessibility is not optional and not a follow-up task. Every component, page, and interaction must be accessible from the start. Retrofitting a11y is far harder than building it in.

## Guidelines

### Semantic HTML
- Use semantic elements: `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<header>`, `<footer>`.
- Use `<button>` for actions, `<a>` for navigation. Never use `<div onClick>` as a button.
- Use `<ul>` / `<ol>` for lists. Screen readers announce list length and position.
- One `<h1>` per page. Follow heading hierarchy: h1 then h2 then h3 — never skip levels.
- Use `<table>` with `<thead>`, `<th>` (with `scope`), and `<caption>` for tabular data.

### ARIA
- **Prefer semantic HTML over ARIA.** A `<button>` is better than `<div role="button">`. Use ARIA only when no native element fits.
- Use `aria-label` or `aria-labelledby` for elements without visible text labels (e.g., icon buttons).
- Use `aria-describedby` to associate help text or error messages with inputs.
- Use `aria-live="polite"` for dynamic content updates (toast notifications, search results count). Use `aria-live="assertive"` only for urgent alerts.
- Use `aria-expanded` for disclosure widgets (accordions, dropdowns).
- Use `role="alert"` for error messages that must be announced immediately.
- Never use `aria-hidden="true"` on focusable elements.

### Keyboard Accessibility
- All interactive elements must be reachable and operable via keyboard.
- Clickable non-button elements need `tabIndex={0}`, `onKeyDown` (Enter and Space), and `role="button"`.
- Modals must trap focus: Tab cycles within the modal, Escape closes it, and focus returns to the trigger element on close.
- Dropdown menus: Arrow keys navigate items, Escape closes, Enter selects.
- Provide skip links (`<a href="#main-content">Skip to content</a>`) on pages with repetitive navigation.

### Color and Contrast
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold).
- Never convey information through color alone. Use icons, text, or patterns as secondary indicators.
- Ensure focus indicators are visible — do not remove `outline` without providing an alternative.

### Images and Media
- Every `<img>` needs an `alt` attribute. Decorative images use `alt=""`.
- Alt text should describe the image's purpose, not its appearance ("Graph showing 40% growth" not "a graph").
- Videos need captions. Audio needs transcripts.

### Forms
- Every input needs a visible `<label>` element linked via `htmlFor`.
- Group related inputs with `<fieldset>` and `<legend>`.
- Associate error messages with inputs via `aria-describedby`.
- Mark required fields with `aria-required="true"` and a visible indicator.
- On validation failure, move focus to the first invalid field.

### Dynamic Content
- Use `aria-live` regions for content that changes without a page reload (search results, notifications, chat messages).
- When content loads asynchronously, announce it: "3 results loaded" rather than silently updating the DOM.
- Route changes in SPAs should announce the new page title to screen readers.

## Testing

- **axe-core:** Run `axe` checks in integration tests. Use `@axe-core/react` in dev or `jest-axe` in unit tests.
- **Lighthouse:** Run the accessibility audit in Chrome DevTools. Target a score of 100.
- **Keyboard testing:** Navigate every page using only Tab, Shift+Tab, Enter, Escape, and Arrow keys.
- **Screen reader testing:** Test with VoiceOver (macOS) or NVDA (Windows) for critical flows.
- **Reduced motion:** Test with `prefers-reduced-motion: reduce` enabled. Disable animations for users who request it.

## Checklist
- [ ] All pages use semantic HTML structure with proper heading hierarchy
- [ ] All interactive elements are keyboard-accessible (focusable, operable)
- [ ] ARIA is used only when no native element suffices
- [ ] Color contrast meets WCAG AA minimums (4.5:1 normal, 3:1 large)
- [ ] Every image has appropriate alt text
- [ ] Every form input has a visible label
- [ ] Modals trap focus and return focus on close
- [ ] Dynamic content updates are announced via aria-live
- [ ] axe-core reports zero violations on all pages
- [ ] Pages are fully navigable via keyboard alone
