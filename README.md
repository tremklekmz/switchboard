# Switchboard — Time Tracker

A professional, mobile-first time-tracking application built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. Switchboard lets you track time across multiple tasks with exclusive timer logic, Azure DevOps work item support, and a fully customizable dark-mode UI.

## Features

- **Exclusive Timer Logic** — Only one task can be active at a time; starting a new task automatically pauses the previous one
- **Quick-Switch Buttons** — One-tap shortcuts for common tasks: Meeting, Admin, Email
- **Azure DevOps Integration** — Enter a work item number (e.g. `#12345` or `12345`) to create a tagged DevOps task
- **Daily Summary** — View a breakdown of time per task with progress bars and a copy-for-billing section
- **6 Accent Color Themes** — Emerald, Blue, Purple, Orange, Rose, Cyan
- **OLED Black Mode** — Pure `#000000` backgrounds for AMOLED/OLED screens
- **Persistent State** — All tasks, timers, and settings are saved to `localStorage`
- **Mobile-First Design** — Touch-optimized tap targets, responsive layout, no zoom

## Tech Stack

| Technology   | Version | Purpose                         |
| ------------ | ------- | ------------------------------- |
| Next.js      | 16.x    | React framework with App Router |
| React        | 19.x    | UI library                      |
| TypeScript   | 5.9.x   | Type-safe JavaScript            |
| Tailwind CSS | 4.x     | Utility-first CSS               |
| Lucide React | 0.575.x | Icon library                    |
| Bun          | Latest  | Package manager & runtime       |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed

### Installation

```bash
bun install
```

### Development

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
bun build
```

### Lint & Type Check

```bash
bun lint
bun typecheck
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx        # Root layout with metadata and fonts
│   ├── page.tsx          # Switchboard main app (client component)
│   ├── globals.css       # Dark theme, CSS variables, animations
│   └── favicon.ico       # Site icon
└── lib/
    └── useLocalStorage.ts  # Hydration-safe localStorage hook
```

## localStorage Keys

| Key                   | Type      | Purpose                        |
| --------------------- | --------- | ------------------------------ |
| `switchboard-tasks`   | `Task[]`  | All tasks and their elapsed time |
| `switchboard-active`  | `string \| null` | ID of the currently active task |
| `switchboard-accent`  | `number`  | Index of the selected accent color |
| `switchboard-oled`    | `boolean` | Whether OLED Black Mode is enabled |

## Theming

Accent colors are applied via CSS custom properties on `:root`:

```css
--accent-h  /* hue */
--accent-s  /* saturation */
--accent-l  /* lightness */
```

OLED mode replaces all `slate-950`/`slate-900` backgrounds with pure `#000000` and `#0a0a0a`, and updates `document.body.style.backgroundColor` and the `<meta name="theme-color">` tag dynamically.

## License

MIT
