# Vayu Research — UI Revamp Design

## Summary

Revamp the frontend from scattered inline styles to a clean, maintainable light-mode design built on CSS custom properties. Navigation moves from a left sidebar to a top bar. All five pages adopt a consistent visual language defined by design tokens in `index.css`.

---

## Decisions Made

| Question | Decision |
|---|---|
| Aesthetic direction | Minimal light mode — white/warm off-white, strong black typography |
| Navigation layout | Top bar (logo + nav links left, search + settings icon right) |
| Prompt Runner | Full page at `/prompt/:id` — form left column, output right column |
| Styling approach | CSS custom properties (design tokens) in `index.css` — no new dependencies |

---

## Design Tokens

All tokens live in `:root` in `index.css`. No colour, spacing, or radius value appears anywhere else — components reference tokens only.

```css
:root {
  /* Backgrounds */
  --bg:           #f8f7f4;   /* page background */
  --bg-surface:   #ffffff;   /* card / panel surface */
  --bg-muted:     #f2f0eb;   /* sidebar, input backgrounds */

  /* Borders */
  --border:       #e8e5df;
  --border-strong: #d0cdc7;

  /* Text */
  --text:         #1a1a1a;   /* primary */
  --text-muted:   #999999;   /* secondary / labels */
  --text-faint:   #cccccc;   /* placeholders, meta */

  /* Accent (category colours) */
  --cat-market-bg:   #f0f7f4;  --cat-market-text:   #2a7a50;
  --cat-fund-bg:     #f0f4fa;  --cat-fund-text:     #2a5a9a;
  --cat-quick-bg:    #f4f0fa;  --cat-quick-text:    #5a2a9a;
  --cat-advanced-bg: #fdf4ea;  --cat-advanced-text: #8a5a1a;
  --cat-visual-bg:   #faf0f4;  --cat-visual-text:   #8a2a5a;

  /* Spacing scale */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-drawer: -4px 0 20px rgba(0,0,0,0.06);
}
```

---

## Components

### Navbar (`Navbar.jsx` — replaces `Sidebar.jsx`)

- Full-width top bar, height 52px, `background: var(--bg-surface)`, `border-bottom: 1px solid var(--border)`
- **Left**: Logo mark `VAYU` (bold, letter-spaced) + nav links — Library, History, Schedules
- **Right**: Search input (160px, moves from PromptsPage) + Settings icon button (`⚙`)
- Active link: `font-weight: 700; color: var(--text)` + `border-bottom: 2px solid var(--text)`
- Inactive link: `color: var(--text-muted)`
- No hover `useState` — use CSS `:hover` with `color: var(--text)` transition

### PromptsPage (`PromptsPage.jsx`)

- Page padding: `var(--space-xl) var(--space-xl)`
- Page title `Research Library` — 20px, weight 900, letter-spacing -0.5px
- Sub-line: prompt count — `var(--text-muted)` 12px
- **Filter chips**: horizontal row, tab-underline style. Active: `color: var(--text); border-bottom: 2px solid var(--text); font-weight: 700`. Inactive: `color: var(--text-muted)`
- **Search** removed from here — lives in Navbar
- **Card grid**: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, gap `var(--space-md)`

### PromptCard (inside PromptsPage)

- `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-card)`
- Hover (CSS only): `border-color: var(--border-strong)`, `box-shadow: 0 4px 12px rgba(0,0,0,0.08)` — no JS state
- Category badge: `background: var(--cat-{id}-bg); color: var(--cat-{id}-text)` — 9px, weight 700, uppercase, `border-radius: var(--radius-sm)`
- Card name: 13px, weight 700, `var(--text)`
- Description: 11px, `var(--text-muted)`, 2-line clamp
- Footer: input count (faint) + `Run →` (weight 700, `var(--text)`)

### PromptRunner (`PromptRunner.jsx`)

- Full page at `/prompt/:id`. Two columns inside a flex container.
- **Left column** (320px fixed, `flex-shrink: 0`):
  - `background: var(--bg-muted)`, `border-right: 1px solid var(--border)`, `padding: var(--space-lg)`
  - Back link `← Library` — 12px, `var(--text-muted)`, hover underline
  - Prompt name: 18px, weight 900
  - Category badge (same token system as cards)
  - Form fields: label 11px `var(--text-muted)`, input `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-sm)`, focus `border-color: var(--border-strong)`
  - Submit button: `background: var(--text); color: #fff`, full width, weight 700
  - Action row below output (save to history, Notion, copy) — icon buttons, `var(--text-muted)`
- **Right column** (flex: 1, scrollable):
  - `background: var(--bg-surface)`, `padding: var(--space-lg) var(--space-xl)`
  - Output label: 11px uppercase `var(--text-faint)`
  - Markdown output: light-mode prose styles in `.md` class in `index.css` — black headings, `var(--border)` for `hr` and table borders, `var(--bg-muted)` for code blocks

### HistoryPage (`HistoryPage.jsx`)

- Full-width table or card list
- Light-mode table: `border: 1px solid var(--border)`, alternating row `background: var(--bg-muted)` on even rows
- Action buttons (download, delete, save to Notion): small icon buttons using CSS `:hover`

### SchedulesPage (`SchedulesPage.jsx`)

- Cards per schedule: same token system as PromptCard
- Status badge (active/paused): green/grey using category-badge pattern
- "New Schedule" button: solid black, same as submit button

### SettingsPage (`SettingsPage.jsx`)

- Section cards: `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-md)`
- Form inputs: same token system as PromptRunner
- Integration status pill: green dot + "Connected" / grey dot + "Not configured"

---

## Styling Rules

1. **No inline `style` objects** anywhere in JSX after this revamp. Every visual property goes through a CSS class in `index.css` or a component-level `.css` file if needed.
2. **No `useState` for hover** — use CSS `:hover` pseudo-class only.
3. **Token-only values** — no hardcoded hex codes or pixel values in JSX or CSS outside of the `:root` token block.
4. **Markdown prose** — the existing `.md` class in `index.css` gets updated for light mode (dark text on white, border colours from tokens).

---

## File Changes

| File | Action |
|---|---|
| `frontend/src/index.css` | Add `:root` token block; update `.md` prose for light mode; add utility classes |
| `frontend/src/App.jsx` | Replace `Sidebar` import with `Navbar`; update layout flex to column |
| `frontend/src/components/Sidebar.jsx` | Delete |
| `frontend/src/components/Navbar.jsx` | Create — top navigation bar |
| `frontend/src/components/PromptsPage.jsx` | Remove inline styles; remove search input (moved to Navbar); apply CSS classes |
| `frontend/src/components/PromptRunner.jsx` | Remove inline styles; apply CSS classes; light-mode output area |
| `frontend/src/components/HistoryPage.jsx` | Remove inline styles; apply CSS classes |
| `frontend/src/components/SchedulesPage.jsx` | Remove inline styles; apply CSS classes |
| `frontend/src/components/SettingsPage.jsx` | Remove inline styles; apply CSS classes |
