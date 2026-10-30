# D-Fence design standard

Reference: the look of https://www.gxs.com.sg/ (colour, type, shape, motion). It is a reference
only. Never use the GXS name, logo, images or copy.

## Direction

The whole site is dark. There is no light mode and no theme toggle (Yen Kit, 2026-10-30: the GXS
palette only works on a fully dark site). Deep eggplant page, raised eggplant cards, neon violet
action colour, big bold headings, pill buttons, large soft cards, short springy motion.

## Colour tokens

Token names in `client/styles.css` stay the same where they can, so existing rules and Tailwind
utilities move with them. Check contrast before you change a value.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#0c0120` | Page background, rail, header |
| `--surface` | `#1a1030` | Cards, table bodies |
| `--surface-raised` | `#272036` | Inputs, hover, menus, chips |
| `--ink` | `#ffffff` | Body text |
| `--ink-quiet` | `#c9c3d6` | Secondary text (at least 4.5:1 on `--surface-raised`) |
| `--line` | `#453b59` | Borders |
| `--accent` | `#af89f4` | Text links, focus rings, outlines, current item text |
| `--accent-fill` | `#771fff` | Primary button and selected fills, always with white text |
| `--accent-dark` | `#8653e3` | Hover and pressed fills |
| `--accent-quiet` | `#2a1a4d` | Selected and tinted backgrounds |
| `--rail` | `#0c0120` | Rail and header |
| `--tier-high`, `--refusal` | `#ff7f9c` | High tier, refusals |
| `--tier-medium` | `#ffd500` | Medium tier |
| `--tier-low` | `#75f9aa` | Low tier |

A tier tint is the tier colour at about 14% over `--surface`. Tier text on its tint must reach 4.5:1.

Never put `--accent` behind white text: that pair fails contrast. Use `--accent-fill`.

Other tokens: `--neon-300 #8653e3`, `--mint #75f9aa`, `--gum #f66f87`, `--bolt #4cc9f0`,
`--thunder #ffd500`.

Add each token to `@theme inline` in `client/tailwind.css` as `--color-*`.

Gradients, for hero bands and hero headings only:

- Brand: `linear-gradient(120deg, #4c00c2, #771fff 25%, #f66f87 50%, #771fff 75%, #272036)`
- Hero: `linear-gradient(#771fff, #0c0120)`

## Type

- Font: Inter, self-hosted through `client/build.mjs`, weights 400, 500, 600, 700. The CSP allows
  fonts from `'self'` only. Keep IBM Plex Mono for code-like values if it is already in use.
- Headings: weight 700, tight tracking. Page title 32px on desktop and 24px on a phone.
- Body: 16px. Never under 12px.
- Hero headings may go to 56px, or 36px on a phone, and may use the brand gradient
  as text fill.

## Shape

- Buttons and chips: full pill. Primary buttons have an `--accent-fill` fill, white bold text and at
  least 44px height. Secondary buttons have a 1px outline.
- Cards: 24px radius, `--surface`, one thin shadow at most. Hero panels: 32px radius.
- Inputs: 12px radius, 44px height.
- Maps: use the dark OneMap basemap. Map overlays and controls use the dark surfaces.
- Tables: keep them dense and aligned. Use tinted row hover, not cards.

## Motion

- Hover and press: `transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)`, with a lift of 2px at
  most or a scale of 1.02 at most.
- Colour: `0.2s ease`.
- Reveal on page or card entry: fade and rise 8px, `0.6s cubic-bezier(0.19, 1, 0.22, 1)`.
- Primary hero button only: the slow animated gradient (`gradientbtn`, 6s or slower).
- CSS only. Do not add a motion library. Do not animate layout properties or map layers.
- Under `prefers-reduced-motion: reduce`, turn off all of this.

## Rules that do not change

- A tier is never colour alone (11.7.5): the word stays.
- Focus stays visible (11.7.2). Use a 2px `--accent` outline with offset.
- Touch targets stay at 44px (11.7.7).
- Text meets WCAG AA (4.5:1, or 3:1 for 18px bold and larger).
- The CSP allows no inline styles and no second stylesheet: use classes only.
- Keep every `data-screen`, `data-part`, `data-state`, `data-requirement` and `data-component`
  attribute, every aria attribute, all visible copy, and all behaviour. Tests depend on them.
- Icons: lucide-react by named import only, `aria-hidden` when decorative.
- Styling on a screen uses Tailwind utilities, on top of the shared classes.
