# Vareq — Frontend Specification

**Status:** approved design direction; implementation has not been approved or started.  
**Product contract:** `APP_BLUEPRINT.md`. **Build sequence:** `BUILD_GUIDE.md`.  
**Scope:** eight-section public landing page, public run inspector, authenticated action states, and operator-assisted testnet evidence. The page must be usable before any real run exists; do not invent one.

## 0. Confirmed design decisions

| Decision | Confirmed direction |
|---|---|
| Identity fingerprint | Asymmetric editorial / expressive display / monochrome plus one accent / solid surface and inline trace / editorial stagger / subtle precision. |
| Dials | Design variance **6/10**, motion **3/10**, information density **6/10**. |
| Gate 1 | Operational bento aesthetic. |
| Gate 2 | B3-style navigation: restrained active-link underline. |
| Gate 3 | Static atmosphere; subtle, replayable viewport reveals; reduced-motion support. No ambient video, particles, parallax or tilt. |
| Gate 4 | Bricolage Grotesque, Source Sans 3, DM Mono. |
| Gate 5 | Mist + burnt orange palette below. |
| Gate 6 | Trace-first asymmetric hero and approved headline/subheading/CTAs verbatim. |
| Gate 7 | Eight sections in the exact order in §5. |

No hardcoded logo, symbol, monogram, partner logo, stock crypto imagery, fake customer proof, fake metric, or decorative token icon. Use **Vareq** as plain text in the chosen typeface. Do not create a brand symbol or favicon mark without asking the owner. All illustrations are restrained interface/trace diagrams, not third-party brand imagery.

## 1. Design tokens and contrast

### Colour

```text
--bg-primary:      #F1F4F0   page / canvas
--bg-secondary:    #E5EAE4   alternating section / muted panels
--bg-surface:      #FAFCF8   standard card
--bg-elevated:     #FDFEFC   modal / popover
--text-primary:    #1C281E   primary type / dark outline
--text-secondary:  #4C5F50   body / interactive border
--text-muted:      #586C5C   secondary labels, not disabled-only text
--border-default:  #7F9583   decorative boundaries only
--accent:          #A34326   primary actions / active underline
--accent-hover:    #812E17   hover / pressed accent
--on-accent:       #FCFBF7   text on accent
--success:         #176744   success text and icon
--warning:         #785000   warning text and icon
--error:           #AD2550   error text and icon
```

Primary text on primary background is approximately 13.81:1; secondary text is 6.19:1; muted text is 5.10:1. Accent text on primary is 5.59:1; on secondary 5.08:1; on surface 6.00:1. `--on-accent` on accent is 5.99:1. Default border on primary is only **2.90:1** and on secondary 2.64:1: use `#4C5F50` or `#1C281E` for boundaries needed to identify an interactive control and use the dark 2px focus ring specified below. Do not use accent text on a dark or accent background. Status colours always accompany an icon/text label and are not the sole indicator.

### Type

Approved stylesheet URL:

`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600&family=Source+Sans+3:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap`

- `font-heading`: Bricolage Grotesque, fallback `system-ui, sans-serif`; weights 500/600.
- `font-body`: Source Sans 3, fallback `system-ui, sans-serif`; weights 400/500/600.
- `font-mono`: DM Mono, fallback `ui-monospace, monospace`; weights 400/500.
- Load with `font-display: swap`. If fonts fail, retain a usable system-font layout. No image of text.
- Body base: `font-body text-base leading-[1.55] text-[#1C281E] antialiased`; user font scaling remains enabled.
- H1: `font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#1C281E] md:text-7xl lg:text-[6rem]`.
- Section H2: `font-heading text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-[#1C281E] md:text-4xl lg:text-5xl`.
- Card H3: `font-heading text-xl font-semibold leading-[1.15] tracking-[-0.02em] text-[#1C281E] md:text-2xl`.
- Paragraph: `font-body text-base leading-[1.55] text-[#4C5F50] md:text-lg`.
- Eyebrow: `font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.14em] text-[#586C5C]`.
- Technical data: `font-mono text-xs leading-5 text-[#4C5F50]`, with `break-all` on hashes only.

### Spacing and breakpoints

- Use a 4px base, then 8/12/16/20/24/32/40/48/64/80/96/128px.
- Shared content container: `mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12`.
- Section padding: `py-16 md:py-24 lg:py-28`; deliberately tighter footer as specified below.
- Breakpoints: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px. Validate 320, 360, 768, 1024, 1280 and 1440px.
- Page avoids horizontal overflow at 320px. Wide trace tables may scroll **inside their own container**, with a visible affordance and keyboard access.
- Decorative default border is `border border-[#7F9583]`; cards use `rounded-2xl`; control corners use `rounded-lg`.

## 2. Motion, layers and accessibility

### Motion contract

All content is visible by default if animation JavaScript does not run. Trigger only after hydration and only when `prefers-reduced-motion: no-preference`; never make information unavailable on animation failure. Do not move the background.

| Element | Initial → animate | Duration / easing / delay | Trigger |
|---|---|---|---|
| Hero eyebrow | opacity 0, y 8px → opacity 1, y 0 | 0.36s, cubic-bezier(0.2,0.65,0.3,1), 0.00s | On first entry. |
| Hero heading | opacity 0, y 12px → opacity 1, y 0 | 0.42s, same curve, 0.05s | On first entry. |
| Hero supporting copy | opacity 0, y 10px → opacity 1, y 0 | 0.42s, same curve, 0.10s | On first entry. |
| Hero CTAs | opacity 0, y 8px → opacity 1, y 0 | 0.36s, same curve, 0.15s | On first entry. |
| Hero trace | opacity 0, y 12px → opacity 1, y 0 | 0.42s, same curve, 0.12s | On first entry. |
| Section headings / body | opacity 0, y 12px → opacity 1, y 0 | 0.42s, same curve, 0s / 0.06s | When ≥15% enters viewport. |
| Bento / comparison cards | opacity 0, y 12px → opacity 1, y 0 | 0.42s, same curve, 0.06s × visual index, capped at 0.18s | When ≥15% enters viewport. |
| Tab/selected-event details | opacity 0 → 1, y 4px → 0 | 0.18s, ease-out, 0s | After explicit selection only. |
| Mobile drawer / modal | opacity 0 → 1; panel y 8px → 0 | 0.18s, ease-out, 0s | On explicit open. |
| Buttons / links | colour or underline only | 0.15s, ease-out, 0s | Hover / focus / press. No scale animation. |

Viewport reveals replay on a new entry after the entire section has left the viewport; do not repeatedly restart while the user is reading. Under reduced motion: initial = final, duration = 0s, delay = 0s; no auto-playing replay or animated loader. Replay controls must remain operable manually. No blinking critical status.

### Global stacking map

- `z-0`: section background and static hairline decoration, `pointer-events-none`.
- `z-10`: ordinary content, cards and diagrams.
- `z-20`: local dropdown positioning and active timeline detail within its stacking context.
- `z-40`: sticky inspector toolbar when present.
- `z-50`: main sticky header.
- `z-[60]`: mobile navigation backdrop.
- `z-[70]`: mobile navigation drawer; any local popover must not cover a modal.
- `z-[80]`: toast region.
- `z-[90]`: modal backdrop.
- `z-[100]`: modal/dialog panel and focus trap.

Each page section below repeats its local stack. Avoid accidental `transform`, `filter`, or `opacity` stacking contexts around global overlays. Portals for dialogs and toasts attach to the document root.

### Accessibility and security

- Landmarks: header/nav, one `main`, labelled sections with one H1 and sequential H2s, footer. Skip link first in DOM.
- Keyboard: visible focus, logical order, arrow-key tabs where tabs are used, Enter/Space controls, Escape closes drawer/dialog, focus returns to opener, modal focus trapped while open. No keyboard trap in the public timeline.
- Minimum targets 44×44px for primary controls, including icon-only controls; descriptive accessible names. Use `aria-current` for active navigation and `aria-expanded`/`aria-controls` for disclosure controls.
- Status changes announced in an `aria-live="polite"` region; transaction failures may use assertive notification without reading the entire log. Pair colours with words/icons.
- Respect reduced motion; don't rely on hover. Text wraps at 200% zoom. Fields have persistent labels, errors and `aria-describedby`.
- Links are links; actions are buttons. A disabled control explains why in visible adjacent text. Do not fabricate dead links, sign-in requirements for reading, or successful receipts.
- Trace text is untrusted: render as text, never injected HTML; validate sizes/types and link schemes; display long hashes safely. Never include secrets in a shareable URL.

## 3. Reusable exact component classes

The class strings below are complete component treatments. Each section refers to these by name and adds only its explicitly listed position/spacing classes. `font-heading`, `font-body`, and `font-mono` are the aliases in §1. Focus and disabled rules apply even if an element has no hover device.

### Buttons and links

**Primary action / primary navigation link**

`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#A34326] bg-[#A34326] px-5 py-3 font-body text-sm font-semibold leading-5 text-[#FCFBF7] transition-colors duration-150 hover:border-[#812E17] hover:bg-[#812E17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E] disabled:cursor-not-allowed disabled:border-[#7F9583] disabled:bg-[#E5EAE4] disabled:text-[#4C5F50]`

**Secondary action / link**

`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#4C5F50] bg-transparent px-5 py-3 font-body text-sm font-semibold leading-5 text-[#1C281E] transition-colors duration-150 hover:bg-[#E5EAE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E] disabled:cursor-not-allowed disabled:opacity-60`

**Text link**

`inline-flex min-h-11 items-center gap-1 font-body text-sm font-semibold text-[#A34326] underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:text-[#812E17] hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E]`

**Icon button**

`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#4C5F50] bg-[#FAFCF8] text-[#1C281E] transition-colors duration-150 hover:bg-[#E5EAE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E] disabled:cursor-not-allowed disabled:opacity-60`

### Surfaces, tags and inputs

- **Surface card:** `rounded-2xl border border-[#7F9583] bg-[#FAFCF8] p-5 md:p-6 lg:p-8`.
- **Elevated panel:** `rounded-2xl border border-[#7F9583] bg-[#FDFEFC] p-5 shadow-[0_12px_32px_rgba(28,40,30,0.08)] md:p-6`.
- **Technical inset:** `rounded-xl border border-[#7F9583] bg-[#F1F4F0] p-4`.
- **Neutral status:** `inline-flex items-center gap-1.5 rounded-full border border-[#4C5F50] bg-[#FAFCF8] px-2.5 py-1 font-mono text-[11px] leading-4 text-[#4C5F50]`.
- **Success status:** `inline-flex items-center gap-1.5 rounded-full border border-[#176744] bg-[#FAFCF8] px-2.5 py-1 font-mono text-[11px] leading-4 text-[#176744]`.
- **Warning status:** `inline-flex items-center gap-1.5 rounded-full border border-[#785000] bg-[#FAFCF8] px-2.5 py-1 font-mono text-[11px] leading-4 text-[#785000]`.
- **Error status:** `inline-flex items-center gap-1.5 rounded-full border border-[#AD2550] bg-[#FAFCF8] px-2.5 py-1 font-mono text-[11px] leading-4 text-[#AD2550]`.
- **Field label:** `mb-2 block font-body text-sm font-semibold leading-5 text-[#1C281E]`.
- **Text field / select:** `min-h-11 w-full rounded-lg border border-[#4C5F50] bg-[#FDFEFC] px-3 py-2.5 font-body text-base text-[#1C281E] placeholder:text-[#586C5C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C281E] disabled:cursor-not-allowed disabled:bg-[#E5EAE4]`.
- **Field error:** `mt-2 font-body text-sm leading-5 text-[#AD2550]`; include a text explanation, not just colour.
- **Divider:** `h-px w-full bg-[#7F9583]` (decorative, `aria-hidden`).
- **Skip link:** `sr-only z-[100] rounded-lg bg-[#1C281E] px-4 py-3 text-[#FCFBF7] focus:not-sr-only focus:fixed focus:left-4 focus:top-4`.

## 4. Global shell and navigation

### Header — B3 active-link underline

- Header: `sticky top-0 z-50 border-b border-[#7F9583] bg-[#F1F4F0]`.
- Inner: `mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12`.
- Text wordmark link: `font-heading text-xl font-semibold tracking-[-0.03em] text-[#1C281E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E]`. Text: `Vareq`. No icon or logo asset.
- Desktop nav: `hidden items-center gap-7 lg:flex`.
- Link: `relative inline-flex min-h-11 items-center font-body text-sm font-semibold text-[#4C5F50] hover:text-[#1C281E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E]`.
- Active underline: `after:absolute after:bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-[#A34326]`; apply `aria-current` to the corresponding link. Do not animate underline across the bar.
- Navigation labels/targets: `How it works` → `/#how-it-works`; `Evidence` → `/#evidence`; `Trust` → `/#trust`; `Inspector` → `/app/runs`. Only the header `Inspector` link navigates to the list. On the landing page, the hero CTA opens an actual published run if one exists; otherwise the list's clear empty state.
- Desktop right action uses Primary action with text `Explore a test run`; it is navigation, not a wallet-gated execution.
- Mobile menu trigger uses Icon button plus `lg:hidden`, labelled `Open navigation` / `Close navigation`. It opens a backdrop `fixed inset-0 z-[60] bg-[#1C281E]/35 lg:hidden` and panel `fixed inset-x-4 top-20 z-[70] rounded-2xl border border-[#4C5F50] bg-[#FDFEFC] p-5 shadow-[0_12px_32px_rgba(28,40,30,0.12)] lg:hidden`. Panel links: `flex min-h-11 items-center border-b border-[#7F9583] py-3 font-body text-base font-semibold text-[#1C281E] last:border-b-0`.
- Close on Escape, backdrop click, link navigation; restore focus. Prevent background scroll while open.
- Header stack: `z-0` page behind; `z-50` header; mobile `z-[60]` backdrop; `z-[70]` panel.

### Global page background

`min-h-screen bg-[#F1F4F0] font-body text-[#1C281E] antialiased`. No gradient, photo, moving grain or fullscreen animation. Optional static hairlines at ≤12% opacity are decoration only, never visually required.

## 5. Landing page: exact section order

### 5.1 Hero — trace-first editorial asymmetry

**Recipe:** `editorial-asymmetric-hero` in `COMPOSITION_RECIPES.md`, adapted to the confirmed solid Mist background and an inline trace rather than a background image. Retain its `relative`, `overflow-hidden`, `z-10`, `font-heading text-5xl md:text-7xl lg:text-[6rem] tracking-tighter leading-[0.9]` editorial scale; use the more legible approved line-height below. Do not copy the recipe's example content.

**Structure**
- Section: `relative overflow-hidden bg-[#F1F4F0]`.
- Container: `relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-12 sm:px-8 md:gap-12 md:pb-24 md:pt-20 lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-24`.
- Left block: `max-w-[46rem]`; eyebrow: §1 eyebrow plus `mb-5`; text `BRIDGE TESTING / BUILT FOR REVIEW`.
- H1: `font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#1C281E] md:text-7xl lg:text-[6rem]`; exact text **“Expose bridge races before deployment.”**
- Subheading: `mt-6 max-w-[38ch] font-body text-lg leading-[1.5] text-[#4C5F50] md:text-xl`; exact text **“AI proposes attack scenarios. Deterministic tests explore event orderings and replay failures for inspection.”**
- CTA row: `mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap`; Primary action **“Explore a test run”**; Secondary action **“See how it works”** → `#how-it-works`.
- Meta line below: `mt-6 font-mono text-[11px] leading-5 text-[#586C5C]`; text `Local replay and testnet receipts are different evidence.`
- Right trace wrapper: `relative w-full max-w-[38rem] justify-self-start lg:justify-self-end`; use Elevated panel, plus `overflow-hidden p-0`.
- Trace heading bar: `flex items-center justify-between gap-3 border-b border-[#7F9583] px-5 py-4`; title `font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#1C281E]`; value `Illustrative trace` using Neutral status.
- Trace body: `space-y-0 px-5 py-2`; each row `grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-[#7F9583]/50 py-4 last:border-b-0`; row number `font-mono text-xs text-[#586C5C]`; label `font-mono text-xs leading-5 text-[#1C281E]`; trailing label `font-mono text-[11px] leading-5 text-[#4C5F50]`.
- Illustrative rows, not results: `01 / Lock / example`, `02 / Hold fill delivery / example`, `03 / Request refund / example`, `04 / Attempt fill / example`. Caption: `border-t border-[#7F9583] px-5 py-3 font-body text-xs leading-5 text-[#4C5F50]`, text `An illustration, not an executed run or receipt.` No transaction hashes, timestamps, success/failure badges or counts.
- Background hairline if used: `pointer-events-none absolute inset-y-0 right-[8%] z-0 hidden border-r border-[#7F9583]/20 lg:block`.

**Z stack:** `z-0` static background/hairline; `z-10` hero content and trace; header `z-50`.  
**Motion:** hero entries as §2; never animate individual fictitious events as if live.  
**Asset brief:** No runtime image or video. The trace is semantic DOM. Before implementation, create one 1600×900 or wider horizontal **visual reference comp** for this section: Mist background, editorial left typography, right restrained event panel, burnt-orange accent; no logo, no symbols, no invented data. It is a composition reference, not an output screenshot or source of copy. `[ASSET PENDING: hero reference comp]`.

### 5.2 Problem — the gap between events

**Recipe:** `full-width-statement`, adapted with a small explanatory paragraph; do not reproduce its example copy. Preserve `py-24 md:py-32 flex items-center` as the desktop composition intent; use the responsive class string below for mobile.

- Section: `relative overflow-hidden border-y border-[#7F9583] bg-[#E5EAE4] py-16 md:py-24 lg:py-32`.
- Container: `relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-5 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-12`.
- Eyebrow: §1 eyebrow, plus `lg:col-span-3`; text `THE PROBLEM`.
- Content: `lg:col-span-9`; H2 `max-w-[18ch] font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#1C281E] md:text-6xl lg:text-7xl`, text `The gap between events is part of the attack surface.`
- Paragraph: `mt-6 max-w-[62ch] font-body text-base leading-[1.55] text-[#4C5F50] md:text-lg`, text `A refund can become valid while a fill message is still in flight. A single-chain success path does not describe every cross-chain ordering.`
- No metrics, testimonials, logos, graph or CTA here.

**Z stack:** `z-0` solid surface; `z-10` statement; header `z-50`.  
**Motion:** §2 section heading/body, 0s / 0.06s delays.  
**Asset brief:** No runtime media. `[ASSET PENDING: problem reference comp]`: one wide Mist/secondary-surface editorial statement with generous whitespace, exact visual hierarchy, no illustration or fake text evidence.

### 5.3 How it works — four-stage asymmetric bento

**Recipe:** `asymmetric-bento-grid`; retain `grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto px-8`, `lg:col-span-7`, `lg:col-span-5`, `rounded-2xl`, and `p-8` on the wide cards where applicable. Adapt to four product stages, not the recipe's example imagery or text. No tilt.

- Section `id="how-it-works"`: `relative bg-[#F1F4F0] py-16 md:py-24 lg:py-28`.
- Header: `relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12`; eyebrow `HOW IT WORKS`; H2 `mt-4 max-w-[20ch]` + §1 H2, text `From bridge assumptions to an inspectable trace.`; paragraph `mt-4 max-w-[58ch]` + §1 paragraph, text `Describe supported actions, suggest bounded scenarios, control the local schedule and inspect what happened.`
- Grid: `relative z-10 mx-auto mt-10 grid w-full max-w-7xl grid-cols-1 gap-6 px-5 sm:px-8 md:grid-cols-2 lg:grid-cols-12 lg:px-12`.
- Card A: Surface card + `md:col-span-1 lg:col-span-7 lg:p-8`; Card B: same + `md:col-span-1 lg:col-span-5 lg:p-8`; Card C: same + `md:col-span-1 lg:col-span-5 lg:p-8`; Card D: same + `md:col-span-1 lg:col-span-7 lg:p-8`.
- Card header row `flex items-start justify-between gap-4`; number chip §3 Neutral status containing `01`, `02`, `03`, `04`; title `mt-5` + §1 Card H3; description `mt-3 max-w-[50ch]` + §1 paragraph; fine rule `mt-6` + §3 Divider; caption `mt-4 font-mono text-xs leading-5 text-[#586C5C]`.
- Exact card copy:
  1. **Adapter** — `Define the bridge actions, actors and invariants the harness is allowed to exercise.` Caption `Developer-authored interface`.
  2. **AI scenarios** — `Suggest action sequences within a fixed schema; validation rejects unsupported or unsafe inputs.` Caption `Groq proposal · untrusted data`.
  3. **Deterministic scheduling** — `Control local message delivery, logical time and event order within stated bounds.` Caption `Controlled local execution`.
  4. **Replay and inspect** — `Review the recorded sequence, state transitions and invariant result with its evidence mode.` Caption `Recorded artefact · explicit provenance`.
- The card numbers are ordinary text, not brand symbols. No arrows implying live onchain connectivity.

**Z stack:** `z-0` background; `z-10` heading/cards; header `z-50`.  
**Motion:** §2 heading/body and card stagger.  
**Asset brief:** No runtime image; card lines and text are semantic DOM. `[ASSET PENDING: workflow reference comp]`: one wide asymmetrical 7/5 + 5/7 bento image in the approved palette; no logos, metric claims, stock symbols or lorem ipsum.

### 5.4 Vulnerable / patched comparison and actual evidence

**Recipe:** bespoke two-column operational comparison at the precision of the golden examples; intentionally not another bento grid. Contrast one ordinary pair of bordered panels with a horizontal evidence row.

- Section `id="evidence"`: `relative border-y border-[#7F9583] bg-[#E5EAE4] py-16 md:py-24 lg:py-28`.
- Container: `relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12`.
- Header row: `grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-10`; eyebrow `THE REFERENCE CASE`; H2 `mt-4` + §1 H2, text `One schedule. Two bridge models.`; right paragraph §1 paragraph, text `Compare an intentionally vulnerable fixture with a trusted-coordinator mitigation. Results appear only after a real run.`
- Pair: `mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6`.
- Each panel: Surface card + `flex h-full flex-col`; header `flex flex-wrap items-center justify-between gap-3`; title §1 Card H3; status §3 Neutral status `Not run` until genuine result.
- Vulnerable body: `mt-5` + §1 paragraph, text `A delayed fill can follow a source refund. The operator's reimbursement attempt may then fail.`
- Patched body: `mt-5` + §1 paragraph, text `A trusted coordinator issues mutually exclusive fill or refund permits. This can prevent the demonstrated race under its assumptions.`
- Boundary note: `mt-5 border-t border-[#7F9583] pt-4 font-body text-sm leading-6 text-[#4C5F50]`; text `The coordinator can censor, fail or equivocate; this is not a production bridge or a safety proof.`
- Evidence row: `mt-6 flex flex-col gap-3 rounded-xl border border-[#4C5F50] bg-[#FAFCF8] p-4 md:flex-row md:items-center md:justify-between`; left title `font-body text-sm font-semibold text-[#1C281E]` text `Evidence`; secondary `font-body text-sm leading-5 text-[#4C5F50]` text `No testnet receipts published yet.` until real release data exists; right Text link `Open published runs` → `/app/runs`.
- Once real results exist, render `Violation`, `Passed within tested bounds`, or `Incomplete` from validated artefacts with mode, scenario, and limitations. Display actual transaction links only if receipt and URL are verified. Never replace pending with preset fake results.

**Z stack:** `z-0` solid background; `z-10` comparison and evidence; header `z-50`.  
**Motion:** §2 section and card reveals.  
**Asset brief:** No runtime media. `[ASSET PENDING: comparison reference comp]`: two balanced side-by-side neutral evidence panels, clear outcome slots, distinct heading and disclosure; no fabricated transaction hashes or pass badges.

### 5.5 SDK and CI — integration without pretend commands

**Recipe:** `architecture-layers`, adapted to a restrained two-column interface rather than a diagram of a different product. Preserve its layered concept while using the exact implementation classes below; no copied examples.

- Section: `relative bg-[#F1F4F0] py-16 md:py-24 lg:py-28`.
- Container: `relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16 lg:px-12`.
- Left eyebrow `FOR BUILDERS`; H2 `mt-4` + §1 H2: `Fit the test into the workflow you already use.`; body `mt-5` + §1 paragraph: `A developer-authored adapter defines what can happen. The SDK and CI use the same bounded scenario and save an artefact for review.`
- Left action: Text link + `mt-5`; label `Explore a test run`, target `/app/runs`. Do not show an `npm install`, package name, version, import, code snippet or repository link until it exists and has actually been verified.
- Right panel: Elevated panel + `p-0`; panel title `border-b border-[#7F9583] px-5 py-4 font-mono text-xs uppercase tracking-[0.12em] text-[#1C281E]`, text `Integration outline`.
- Three ordered rows: `grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[#7F9583]/50 px-5 py-5 last:border-b-0`; number `font-mono text-xs text-[#586C5C]`; row title `font-body text-base font-semibold text-[#1C281E]`; row detail `mt-1 font-body text-sm leading-6 text-[#4C5F50]`.
- Row text: `01 / Describe the adapter / Declare allowed actions, actors and invariants.`; `02 / Execute in CI / Run curated or validated scenarios; fail on an unexpected violation.`; `03 / Inspect the artefact / Share a sanitised trace with a reviewer.`

**Z stack:** `z-0` background; `z-10` content/panel; header `z-50`.  
**Motion:** §2 section reveals; no fake terminal typing animation.  
**Asset brief:** No runtime media. `[ASSET PENDING: SDK/CI reference comp]`: one wide split section with a plain editorial explanation and three-row integration panel; no faux code or package names.

### 5.6 Trust and limits — explicit evidence boundaries

**Recipe:** bespoke editorial rail plus three stacked disclosures; distinct from the preceding split. Static by default; disclosures, if used, are accessible native buttons with a visible summary.

- Section `id="trust"`: `relative border-t border-[#7F9583] bg-[#FAFCF8] py-16 md:py-24 lg:py-28`.
- Container: `relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12`.
- Left: `lg:col-span-5`; eyebrow `TRUST & LIMITS`; H2 `mt-4` + §1 H2, text `A useful trace is honest about its limits.`; body `mt-5` + §1 paragraph, text `Vareq helps explore specific failures. It does not prove a bridge safe.`
- Right: `space-y-0 lg:col-span-7`; each item `border-t border-[#7F9583] py-6 last:border-b`; summary `flex w-full min-h-11 items-start justify-between gap-4 text-left font-heading text-xl font-semibold text-[#1C281E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1C281E]`; text `mt-3 max-w-[60ch] font-body text-base leading-[1.55] text-[#4C5F50]`; disclosure icon `h-5 w-5 shrink-0 text-[#1C281E]` with accessible expanded/collapsed state.
- Items, open by default on all screens to avoid hiding critical disclosure:
  - `AI proposes; tests decide.` / `Model output is untrusted scenario data. A validator and defined invariants determine what can run and what the results mean.`
  - `Local replay is controlled.` / `Reproducibility depends on the same fixture, inputs, seed, environment and tool versions. A browser model is not an EVM execution.`
  - `Public chains are not deterministic.` / `Live transactions can be delayed, reordered or reorganised. Receipts are observations, not guaranteed cross-chain finality or atomicity.`
  - `The mitigation trusts a coordinator.` / `It assumes a non-equivocating authority and an explicit receipt policy; it can lose liveness or fail if that authority is compromised.`

**Z stack:** `z-0` background; `z-10` text/disclosures; header `z-50`.  
**Motion:** §2 section reveals; disclosure expand/collapse is instantaneous under reduced motion, otherwise opacity 0→1 and height auto over 0.18s ease-out, 0s delay; no motion that delays reading.  
**Asset brief:** No runtime media. `[ASSET PENDING: trust reference comp]`: one wide editorial left rail and right list of four readable disclosures; no lock graphics, shields or logos.

### 5.7 Final action

**Recipe:** bespoke solid CTA band; not another card grid.

- Section: `relative bg-[#1C281E] py-16 md:py-20 lg:py-24`.
- Container: `relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:px-12`.
- Eyebrow `font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.14em] text-[#FCFBF7]` text `START WITH THE TRACE`.
- H2 `mt-4 max-w-[16ch] font-heading text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-[#FCFBF7] md:text-5xl`, text `See the sequence, not just the outcome.`
- Body `mt-4 max-w-[54ch] font-body text-base leading-[1.55] text-[#FCFBF7]`, text `Explore a published example without connecting a wallet.`
- Action uses Primary action with `border-[#FCFBF7] hover:border-[#FCFBF7] focus-visible:outline-[#FCFBF7]` on the dark background; the light border preserves a visible control boundary against the dark section. Text `Explore a test run` → actual published run if available, otherwise `/app/runs`.

**Z stack:** `z-0` dark static background; `z-10` content/action; header `z-50`.  
**Motion:** §2 section reveals.  
**Asset brief:** No runtime media. `[ASSET PENDING: final-action reference comp]`: wide dark solid band with left aligned off-white text and one burnt-orange action; no gradients, logos or decorative illustration.

### 5.8 Footer

**Recipe:** bespoke utility footer, no video or imagery.

- Footer: `relative border-t border-[#7F9583] bg-[#E5EAE4] py-10 md:py-12`.
- Container: `relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-start md:justify-between lg:px-12`.
- Left word: `font-heading text-xl font-semibold tracking-[-0.03em] text-[#1C281E]`; text `Vareq`; description `mt-2 max-w-[36ch] font-body text-sm leading-6 text-[#4C5F50]`, text `A bridge-testing workflow with explicit evidence and limits.`
- Nav list: `flex flex-wrap gap-x-6 gap-y-2`; each actual link uses Text link. Safe initial destinations: `How it works` → `/#how-it-works`, `Inspector` → `/app/runs`, `Event` → official event detail page. Add `GitHub`, `Documentation` or `Privacy` only after those destinations really exist and are accurate.
- Legal/metadata row: `mt-8 border-t border-[#7F9583] pt-4 font-mono text-[11px] leading-5 text-[#586C5C]`; text `Testnet demonstration. No production funds.` Use the actual current year only if a copyright line is intentionally added.

**Z stack:** `z-0` background; `z-10` content; header `z-50`.  
**Motion:** no entrance animation required.  
**Asset brief:** No runtime media. `[ASSET PENDING: footer reference comp]`: one wide utility footer, plain typographic name and real navigational links; no logos or fake legal text.

## 6. Public run inspector

### Route map and gate behavior

| Route | Access | Contents |
|---|---|---|
| `/` | Public | Eight sections above. |
| `/app/runs` | Public | Published runs list or honest empty state. |
| `/app/runs/:runId` | Public | One published run, its trace, results and evidence. |
| Internal action modal | Privy authenticated **and** connected wallet | Local model run, recorded playback, scenario request, save/export, or testnet transaction. |

These paths are proposed routes, not currently live. Use SPA direct-link fallback and route-specific not-found state. No login redirect or wallet overlay on a read-only public route. Public controls for reading—selecting a trace event, filtering visible rows and navigating receipt links—stay available without a wallet. Running, replaying, proposing, exporting/saving and signing require the gate.

### Inspector shell

- Outer: `min-h-screen bg-[#F1F4F0]`.
- Inner: `mx-auto w-full max-w-7xl px-5 pb-20 pt-8 sm:px-8 md:pt-12 lg:px-12`.
- Breadcrumb: `flex flex-wrap items-center gap-2 font-body text-sm text-[#4C5F50]`; current title `font-semibold text-[#1C281E]`; links use visible underline/focus.
- Title row: `mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between`; title `font-heading text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-[#1C281E] md:text-4xl`; description `mt-2 max-w-[66ch] font-body text-base leading-6 text-[#4C5F50]`.
- Action cluster `flex flex-wrap gap-3`; use §3 Primary/Secondary; labels `Run reference model`, `Replay`, and optionally `Generate scenario`. Gated, never fake execution.
- Metadata row `mt-6 flex flex-wrap gap-2`; use §3 status tags for mode, scenario origin, state and bounds.
- Main grid `mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]`.
- Primary panel Surface card + `min-w-0`; right rail `space-y-6` containing separate Surface cards for invariants, evidence and limits.
- At <1024px stack the trace first and right rail second. On mobile no sticky bottom element may obscure the final event or keyboard focus.
- Stack: `z-0` background; `z-10` panels; `z-20` local timeline selections; optional `z-40` sticky action toolbar; header `z-50`; global overlays per §2.

### Runs list

- Header eyebrow `PUBLISHED RUNS`; H1 `Inspectable runs`; body `Public examples are viewable without a wallet.`
- List `mt-8 grid grid-cols-1 gap-4`; each actual run is a semantic article `rounded-2xl border border-[#4C5F50] bg-[#FAFCF8] p-5 transition-colors duration-150 hover:bg-[#FDFEFC] md:p-6` containing title `font-heading text-xl font-semibold text-[#1C281E]`, visible mode/origin/result tags, one-line bounds, and Text link `Inspect run` to its real ID.
- Empty: Surface card + `mt-8 text-left`; title `No published runs yet.`; body `A real run will appear here after it has been reviewed and published.`; secondary link `See how it works` → `/#how-it-works`. Do not generate a fake run or disable the whole app.
- Loading: three static `rounded-2xl border border-[#7F9583] bg-[#E5EAE4] p-6` blocks with `aria-busy`; status text `Loading published runs…`. Respect reduced motion.
- Error: Surface card with error status and text `Runs could not be loaded. Try again.`; Secondary action `Retry` when retriable.

### Run detail, event timeline and invariants

- Header must show provenance before any result: `Local reference model`, `Local EVM execution`, or `Observed testnet transactions`, plus `AI suggested`, `Curated`, or `Human-authored` from actual data. A model trace cannot be presented as a testnet result.
- Timeline heading row `flex flex-wrap items-center justify-between gap-3`; H2 `font-heading text-xl font-semibold text-[#1C281E]`; record order label `font-mono text-xs text-[#4C5F50]`.
- List: `mt-5 space-y-2`; event button `grid min-h-14 w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#7F9583] bg-[#FDFEFC] px-3 py-3 text-left transition-colors duration-150 hover:border-[#4C5F50] hover:bg-[#E5EAE4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C281E]`; selected state changes border to `border-[#1C281E]` and background to `bg-[#E5EAE4]`, with accessible selection semantics.
- Event number `font-mono text-xs text-[#586C5C]`; event name `font-mono text-xs leading-5 text-[#1C281E]`; state `font-mono text-[11px] leading-4 text-[#4C5F50]`; selected event detail technical inset + `mt-4`.
- Event detail rows `grid grid-cols-1 gap-1 border-b border-[#7F9583]/50 py-3 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)]`; field label `font-mono text-[11px] uppercase tracking-[0.1em] text-[#586C5C]`; value `min-w-0 break-words font-mono text-xs leading-5 text-[#1C281E]`.
- Invariant panel H2 `font-heading text-lg font-semibold text-[#1C281E]`; each item `mt-4 border-t border-[#7F9583] pt-4`; show status `Violation`, `Passed within tested bounds`, or `Incomplete` **only** when artefact indicates it, with reason, bounds and supporting event IDs. `Pending` is not `Passed`.
- Evidence panel H2 same; each actual receipt displays chain, role (user/operator/attester), contract, transaction, status, block and observed confirmations when available. Link is real and verified; otherwise provide copyable text and `Explorer link unavailable`. Long hashes use `break-all`, never shorten without full accessible text.
- Playback is an explicit connected-wallet action: play/pause, step forward/back, restart and speed controls. It plays **recorded** rows only; label `Recorded playback — no new chain execution`. Default reduced-motion mode is manual stepping. Do not auto-play or imply deterministic public-chain re-execution.

### Compare two reference runs

If a validated release manifest relates a vulnerable and patched run with the same scenario/bounds, show two columns `grid grid-cols-1 gap-4 md:grid-cols-2`; each panel carries its own mode, actual status and evidence. If a pair is absent or incompatible, display `Comparison unavailable: matching runs have not been published.` Never merge evidence from different executions into one fabricated run.

## 7. Identity, action and error states

### Privy entry flow

1. Action click while logged out opens the provider's supported login experience: **Google** or **wallet**. Do not use a custom Google logo or another vendor logo. Public reading remains behind the modal and is not blocked on page load.
2. After Google login with no wallet, show an app-owned chooser: `Connect an external wallet` or `Create an embedded wallet`. Describe that the embedded wallet is created only after the user chooses it. Wallet login may already supply an external wallet; verify active connection.
3. Signed-in-but-disconnected state shows `Wallet required for this action` and Secondary action `Connect wallet`; Google identity by itself is insufficient.
4. For local reference run: show selected preset and seed, label `Runs a local reference model, not smart contracts`, cap actions, then Primary `Run reference model`.
5. For AI: show input summary, `Groq receives this scenario context`, privacy link when available, remaining budget if trustworthy, and `Generate scenario`. Valid output is marked `AI suggested` and still requires validation. Provider failure offers a distinct `Use curated scenario` option, labelled curated.
6. For testnet: actual chain name and ID, real contract, action, reference token/amount, role, and wallet address appear before wallet confirmation. Wrong network blocks signing and offers `Switch network` only when supported; never silently switch or transact. Show that the operator must separately approve and fund its role.

### Shared modal presentation

- Backdrop: `fixed inset-0 z-[90] bg-[#1C281E]/45`.
- Dialog: `fixed left-1/2 top-1/2 z-[100] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#4C5F50] bg-[#FDFEFC] p-5 shadow-[0_20px_64px_rgba(28,40,30,0.18)] md:p-6`.
- Title `font-heading text-2xl font-semibold tracking-[-0.02em] text-[#1C281E]`; body `mt-3 font-body text-base leading-6 text-[#4C5F50]`; actions `mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end` using §3 buttons; close icon uses §3 Icon button with label `Close`.
- Trap and restore focus, Escape closes unless an actual wallet request is pending; do not imply that closing cancels an already submitted transaction.

### Transaction state map

| State | Copy and behaviour |
|---|---|
| Not enabled | `Live testnet demonstration is not available yet.` Link to published/local evidence, no signing prompt. |
| Wrong chain | `Switch to the required testnet before signing.` Display verified chain name and ID; block submission. |
| Missing funds / reference tokens | `This wallet needs testnet gas or demo tokens.` Provide an organiser-approved route if verified; no promises about faucet availability. |
| Operator unavailable | `Operator assistance is not currently available. A signed lock will not automatically trigger a fill.` Do not ask for a lock unless the user acknowledges the limitation. |
| Awaiting signature | `Confirm in your wallet.` Show cancellable wallet step where supported. |
| User rejects | `Signature declined. No transaction was sent.` Only if provider confirms no submission. |
| Submitted | `Transaction submitted; awaiting receipt.` Show actual hash and network; prevent accidental duplicate submission. |
| Receipt success | `Transaction confirmed by the observed receipt.` Show block/confirmations and reorg caveat. Do not say final unless a real finality policy supports it. |
| Receipt failed | `Transaction failed on the testnet.` Show actual reason if available, no fabricated explanation. |
| Timeout / RPC error | `Receipt not yet confirmed. Check the transaction before retrying.` Preserve real hash; do not label failed or re-submit automatically. |
| Reorg / missing receipt | `The previously observed receipt changed or is no longer available.` Mark the evidence incomplete and allow recheck. |

### Global states

- **Auth loading:** `Checking session…`, keep public data visible; do not flash redirect.
- **No wallet:** explain requirement and connect action; no `0x000…` placeholder.
- **Scenario invalid:** list specific validation errors; do not run or silently repair.
- **AI quota exceeded:** `Scenario suggestions are temporarily limited.` Offer curated scenario; do not expose backend secrets or exact provider error bodies.
- **Model running:** static progress text `Running bounded local scenario…`, cancel only if actual cancellation is supported; track step count only if genuine.
- **No matching route/run:** `Run not found or not published.` Offer `View published runs`.
- **Unsupported artefact:** `This trace uses an unsupported format.` Show schema version if present; do not execute or render unsafe HTML.
- **Offline:** `Network unavailable. Previously loaded local information may still be visible.` Avoid implying new results were fetched.

## 8. Asset, responsive and review handoff

### Asset plan

- Runtime artwork: none required. Use semantic HTML, CSS lines and simple inline UI shapes. No logo assets, stock photos, video, illustrations, external icon brand marks, or CDN-dependent imagery.
- Font URLs are the approved Google Fonts URL in §1; use robust fallbacks. If self-hosted later, verify font licence and preserve family/weights.
- **Reference comps:** prior to coding the landing page, produce **one separate horizontal visual reference per each of the eight sections** using the asset briefs above. These are planning references only, not proof that a UI exists and not assets the page must load. Each should be wide (at least 1600×900), use the same palette and typography family, contain no brand marks, fabricated metrics or receipts. If generated text is inaccurate, this document's exact copy wins. Review the references against the approved gates; do not create or copy a logo.
- Pending reference files are intentionally marked `[ASSET PENDING]`; they are not yet generated and do not justify creating project code without approval.

### Responsive acceptance

- **320–639px:** single-column page, 20px outer gutters, stacked CTAs, trace `w-full`, cards 1-column, 44px controls, menu drawer, no body horizontal scroll.
- **640–767px:** 32px gutters, CTA row can sit side by side, trace still below hero text.
- **768–1023px:** 32px gutters, bento 2 columns, comparison 2 columns, inspector stacks, no header clipping.
- **1024–1279px:** 48px gutters, split hero and inspector rail, bento 12-column, desktop navigation visible.
- **1280px+:** max content width 1280px; preserve asymmetric hero balance and readable line lengths.
- At every width, Google login is not mistaken for a connected wallet; published run information remains readable and controls do not overlap the footer or modal.

### Pre-handoff self-check

- [ ] Each section follows the exact hierarchy, section ordering, classes and copy above; reusable component classes include all interaction states.
- [ ] All animations specify initial/final values, duration, easing, delay and trigger; reduced-motion and no-JS visibility work.
- [ ] Each section has a documented z-index stack and asset brief; pending comps are generated/reviewed **before implementation**, not mistaken for the running UI.
- [ ] Confirmed palette and fonts are used; interactive borders/focus indicators meet contrast needs; no colour-only result.
- [ ] Hero trace says illustrative; status/receipt/AI origin comes from actual validated evidence, never fabricated.
- [ ] Public read-only routes work without auth; every specified action has the proper wallet gate and server-side protections where applicable.
- [ ] Testnet signer identities and local/browser/EVM/public provenance are explicit.
- [ ] Layout checked at 320/360/768/1024/1280/1440px, with keyboard, zoom, reduced motion and screen reader.
- [ ] No logos/brand symbols added without asking; only real links and verified commands are displayed.
