# StudyMint Design System

A calm, focused visual system for a productivity app. It uses CSS custom properties for theming and a small set of reusable components.

## Design Principles

1. **Calm and focused** – low-contrast backgrounds, generous whitespace, and no harsh accents.
2. **Friendly** – rounded corners, soft shadows, and a single primary color per theme.
3. **Consistent** – every surface, button, and input shares the same radius, shadow, and spacing logic.
4. **Themeable** – all colors are tokens, so switching themes is one attribute change.
5. **Accessible** – interactive elements have visible focus states and sufficient contrast.

## Tokens

### Colors

Semantic token     | Default (Sage) | Usage
-------------------|----------------|-------
`--bg`             | `#f6f7f4`      | Page background
`--card`           | `#ffffff`      | Cards, modals, elevated surfaces
`--text`           | `#2a332e`      | Headings and primary text
`--muted`          | `#6e7b73`      | Secondary text, placeholders, icons
`--primary`        | `#5b8a72`      | Buttons, active states, links
`--primary-hover`  | `#4a7360`      | Primary hover / pressed
`--secondary`      | `#e8ebe5`      | Secondary buttons, borders, dividers
`--secondary-hover`| `#daddd7`      | Secondary hover
`--danger`         | `#c1666b`      | Delete, reset, errors
`--danger-hover`   | `#a85459`      | Danger hover
`--success`        | `#6b9e75`      | Success messages, study streaks
`--shadow`         | see CSS        | Default card shadow
`--radius`         | `12px`         | Default corner radius

### Themes

The active theme is set by a `data-theme` attribute, usually on `<html>` or `<body>`. The available themes are:

Theme   | Mood                          | Primary
--------|-------------------------------|--------
Sage    | Calm, natural, default        | `#5b8a72`
Pink    | Warm, playful                 | `#c27ba0`
Blue    | Cool, focused                 | `#4a7c9b`
Yellow  | Energetic, sunny              | `#c9a227`
Grey    | Minimal, monochrome           | `#5a5a5a`
Dark    | Night mode                    | `#7ab894`

### Spacing

Use the existing spacing scale through direct `rem` values in components. Common values:

- `0.25rem` – icon gaps, tight padding
- `0.5rem`  – inline spacing
- `0.75rem` – button padding, list item gaps
- `1rem`    – card padding, section gaps
- `1.5rem`  – page gutters, large card padding
- `2rem`    – modal padding, hero spacing

### Typography

- **Font family:** system sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
- **Numeric data:** `font-variant-numeric: tabular-nums` for timers, counts, and leaderboard points
- **Headings:** `font-weight: 700` or `800`
- **Body:** `line-height: 1.5`

## Components

### Buttons

```html
<button class="btn-primary">Primary</button>
<button class="btn-secondary">Secondary</button>
<button class="btn-danger">Danger</button>
<button class="btn-icon">✕</button>
<button class="btn-link">Cancel</button>
```

### Cards

```html
<div class="card">
  <h3>Card title</h3>
  <p>Card content</p>
</div>
```

### Forms

```html
<label>
  Label text
  <input type="text" placeholder="Placeholder" />
</label>
```

Focus state uses the primary color with a soft glow.

### Lists

```html
<ul class="list">
  <li>
    <div class="task-main"><strong>Task</strong><small>Due date</small></div>
    <div class="actions"><button class="btn-icon">✓</button></div>
  </li>
</ul>
```

### Tabs

```html
<div class="tasks-tabs">
  <button class="tab-btn active">Tab 1</button>
  <button class="tab-btn">Tab 2</button>
</div>
```

### Tables

```html
<table class="table">
  <thead><tr><th>Header</th></tr></thead>
  <tbody><tr><td>Cell</td></tr></tbody>
</table>
```

## Calendar Tokens

The calendar uses semantic surface tokens plus a few dedicated tokens:

- `--cal-event-bg` / `--cal-event-text` – event chips
- `--cal-task-bg` / `--cal-task-text` – task chips
- `--cal-task-completed-opacity` – completed task dimming
- `--cal-shape-school`, `--cal-shape-family`, `--cal-shape-work` – visual calendar shape fills

These are defined per-theme so the calendar looks correct in every palette.

## Leaderboard Tokens

The leaderboard defines its own local tokens inside `.lb-page` but maps them to the global theme tokens:

- `--lb-blue` → `--primary`
- `--lb-blue-dark` → `--primary-hover`
- `--lb-green` → `--success`
- `--lb-gold` → `--color-accent` (themeable gold)
- `--lb-ink` → `--text`
- `--lb-muted` → `--muted`
- `--lb-card` → translucent surface
- `--lb-line` → `--secondary`

## Adding a New Theme

1. Add a new `[data-theme="name"]` block in `public/styles.css` after the existing themes.
2. Override the color tokens (`--bg`, `--card`, `--text`, `--muted`, `--primary`, `--primary-hover`, `--secondary`, `--secondary-hover`, `--danger`, `--danger-hover`, `--success`).
3. Add an `<option value="name">Label</option>` to the theme `<select>` in `public/index.html`.
4. Optionally document the new palette in this file.

## Files

- `public/styles.css` – all tokens and component styles
- `public/app.js` – theme switching logic via `localStorage`
- `public/design-system.html` – live preview of tokens and components
- `docs/design-system.md` – this document
