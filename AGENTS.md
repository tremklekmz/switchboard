# AGENTS.md — AI Agent Instructions for Switchboard

This file provides guidance for AI agents (Kilo Code, Copilot, Cursor, etc.) working on this project.

## Project Overview

**Switchboard** is a mobile-first time-tracking app built on Next.js 16 + React 19 + TypeScript + Tailwind CSS 4. It uses exclusive timer logic, localStorage persistence, and a CSS-variable-driven theming system.

## Critical Rules

- **Package manager**: Use `bun` (not npm or yarn)
- **Never run** `next dev` or `bun dev` — the sandbox handles this automatically
- **Always commit and push** after completing changes:
  ```bash
  bun typecheck && bun lint && git add -A && git commit -m "descriptive message" && git push
  ```

## Commands

| Command          | Purpose                        |
| ---------------- | ------------------------------ |
| `bun install`    | Install dependencies           |
| `bun build`      | Build production app           |
| `bun lint`       | Check code quality (ESLint)    |
| `bun typecheck`  | Run TypeScript type checking   |

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout + metadata + fonts
│   ├── page.tsx            # Switchboard main app (single client component)
│   ├── globals.css         # Dark theme, CSS variables, custom scrollbar, animations
│   └── favicon.ico
└── lib/
    └── useLocalStorage.ts  # Hydration-safe localStorage hook (useSyncExternalStore)
```

### Key Design Decisions

- **Single-page app**: All logic lives in `src/app/page.tsx` as a `"use client"` component
- **Exclusive timer**: Only one task active at a time; `activeTaskId` stored in localStorage
- **CSS variables for theming**: Accent color applied via `--accent-h`, `--accent-s`, `--accent-l` on `:root`
- **Inline styles for dynamic values**: Runtime theme switching uses inline styles, not Tailwind classes
- **OLED mode**: Replaces slate backgrounds with pure `#000000`/`#0a0a0a`; also updates `document.body.style.backgroundColor` and `<meta name="theme-color">`
- **Hydration safety**: `useHydrated()` (from `useLocalStorage.ts`) prevents SSR/client mismatch; renders a spinner until hydrated

### localStorage Keys

| Key                   | Type             | Default |
| --------------------- | ---------------- | ------- |
| `switchboard-tasks`   | `Task[]`         | `[]`    |
| `switchboard-active`  | `string \| null` | `null`  |
| `switchboard-accent`  | `number`         | `0`     |
| `switchboard-oled`    | `boolean`        | `false` |

## Optional Feature Guides

When users request features beyond the current app, check for available recipes in `.kilocode/recipes/`.

### Available Recipes

| Recipe       | File                                | When to Use                                           |
| ------------ | ----------------------------------- | ----------------------------------------------------- |
| Add Database | `.kilocode/recipes/add-database.md` | When user needs data persistence (users, posts, etc.) |

### How to Use Recipes

1. Read the recipe file when the user requests the feature
2. Follow the step-by-step instructions
3. Update the memory bank after implementing the feature

## Memory Bank Maintenance

After completing the user's request, update the relevant memory bank files:

- `.kilocode/rules/memory-bank/context.md` — Current state and recent changes
- `.kilocode/rules/memory-bank/architecture.md` — If architecture patterns change
- `.kilocode/rules/memory-bank/tech.md` — If dependencies or tooling change
- `.kilocode/rules/memory-bank/product.md` — If product goals or UX flows change

## Code Style Guidelines

- **TypeScript strict mode** is enabled — avoid `any`, use proper types
- **Server Components by default** — add `"use client"` only when interactivity is needed
- **Tailwind CSS** for static styles; inline styles for dynamic/runtime values
- **`useCallback`** for event handlers to avoid unnecessary re-renders
- **Component naming**: PascalCase for components, camelCase for utilities
- **File naming**: lowercase for pages/routes, PascalCase for components

## Common Patterns

### Adding a new quick-switch task

Edit the `QUICK_TASKS` constant in [`src/app/page.tsx`](src/app/page.tsx):

```ts
const QUICK_TASKS = ["Meeting", "Admin", "Email", "YourNewTask"];
```

### Adding a new accent color

Edit the `ACCENT_OPTIONS` array in [`src/app/page.tsx`](src/app/page.tsx):

```ts
{ name: "Teal", h: 174, s: "72%", l: "40%" }
```

### Adding a new persisted setting

Use the `useLocalStorage` hook from [`src/lib/useLocalStorage.ts`](src/lib/useLocalStorage.ts):

```ts
const [mySetting, setMySetting] = useLocalStorage<boolean>("switchboard-mysetting", false);
```

### Adding a new page/route

Create `src/app/your-route/page.tsx` following Next.js App Router conventions.
