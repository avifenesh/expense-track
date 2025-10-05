# UI & UX Guide

## Design Sources & Inspiration
- **Apple Human Interface Guidelines – Layout & Hierarchy**: borrow spacing rhythm, clear typography, and focus states. https://developer.apple.com/design/human-interface-guidelines/
- **Microsoft Power BI Dashboard Guidance**: card hierarchy, progressive disclosure, and accessible color use. https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards
- **Tailwind UI Patterns**: leverage existing utility conventions for spacing, elevation, and responsive layout.

## Core Visual Language
- **Theme**: dark slate gradient background, glassmorphism panels (`bg-white/10`, `backdrop-blur`, subtle border). Maintain this across new surfaces.
- **Typography**: Inter family (already loaded). Headings use tracking-tight, body text `text-slate-200/80`. Avoid custom fonts.
- **Color**: Use Tailwind slate/emerald/sky scales for text and accents. Success = emerald, warnings = rose/amber. Holdings badges use emerald glow.
- **Spacing**: Base unit `0.5rem` (Tailwind scale). Cards/panels use `p-5` or `p-6`. Maintain `gap-4` grid rhythm.
- **Shadow & Elevation**: Prefer subtle `shadow-xl` or `shadow-sm` combined with `border-white/10` outlines.

## Interaction Patterns
- Buttons rely on `/src/components/ui/button.tsx` variants. Do not inline custom button styles.
- Inputs/selects mirror `/src/components/ui/input.tsx` and `select.tsx`. Keep rounded, translucent look.
- Tabs and quick actions use pill navigation; match existing tab markup for accessibility (`aria-controls`, `role="tab"`).
- Feedback states use inline text badges (emerald for success, rose for error). Reuse pattern from dashboard forms.

## Before Introducing a New Component
1. **Audit Needs**: confirm no existing component fits (search `src/components`). Extend instead of recreating.
2. **Design Review**: sketch and validate against the themes above; ensure glass panel framing and dark mode contrast.
3. **Accessibility Check**: add semantic roles/aria labels, ensure keyboard focus, and verify color contrast (4.5:1 minimum).
4. **Cross-Account Considerations**: components should respect the active account context; avoid hard-coded account names.
5. **Story/Usage Notes**: document any new Tailwind tokens or props within the component file, and update `docs/ui-ux-guide.md` if the pattern is reusable.
6. **Validation**: run `npm run lint`, `npm run build`, and relevant Playwright paths to confirm styling and focus flows work in the seeded environment.

## Motion & Micro-interactions
- Prefer Tailwind transitions (`transition`, `duration-200`) for hover/focus. Avoid heavy animation libraries.
- Loading spinners: reuse button inline spinner or Tailwind `animate-pulse` blocks; keep minimal to preserve clarity.

## Asset & Icon Usage
- Use `lucide-react` icons already in `package.json`. Keep stroke width consistent (`className="h-4 w-4"`).
- Images/illustrations should live in `public/` and respect the dark theme (desaturated backgrounds).

Staying within these boundaries ensures new work feels cohesive and keeps the Avi/Serena dashboard approachable and performant.
