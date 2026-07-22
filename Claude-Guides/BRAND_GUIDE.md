# Republic of Rhodesia — Government Portal Brand Guide

This is the reference document for anyone (human or Claude) doing future design or content work on this site. It records *why* the site looks the way it does, not just what the CSS says — read it before changing colors, adding imagery, or introducing new page types.

## What this project is

A fictional alternate-history government services portal for the Republic of Rhodesia, built for a Roblox/Discord roleplay community ("Ro-Nation"). It is styled after real government service portals (e.g. portal.kansas.gov) — search bar, service directory, agency listings, news/notices, founding documents — but with its own invented branding, not the branding of any real government or of Kansas.

Every page's footer must carry a disclaimer that this is fictional worldbuilding content, not a real government. Never drop that disclaimer, and never write copy that presents the site as anything other than fiction if asked to expand it.

## Citizen's Hub (accounts)

The site has a real backend (Cloudflare Worker + D1) for citizen accounts at `/citizens-portal/` and a separate staff review system at `/group-community-management/` (login only, no public registration — staff accounts are provisioned via `scripts/create-staff-user.mjs` or by an existing staff member).

**Current state:** `/citizens-portal/index.html` ("Citizen's Hub") is linked directly from the main site's nav (a gold pill-styled link, `.nav-cta` in `layout.css`) on every public page. This reverses an earlier decision to keep it unlinked/hidden — the owner explicitly asked for it to be reachable via a button, so treat it as a normal, discoverable part of the site now, not a hidden section. The hub page leads with "Create Account" as the primary action, "Log In" as secondary, and a small "Staff & Admin Log In" link at the bottom pointing to the separate staff portal.

Citizen and staff sessions remain fully separate (different cookies, different tables) — that architectural separation is unrelated to the nav-visibility decision above and should stay in place.

## Brand identity

- **Name:** Republic of Rhodesia — Government Portal
- **Motto:** "Sit Nomine Digna" ("May she be worthy of the name") — used sparingly, in serif italic, as a bookend on formal pages (hero, footer, document pages), not decoration on every element.
- **Capital:** Salisbury
- **Tone:** formal, institutional, slightly archival — this is a *government records* site, not a marketing site. Copy should read like an official notice or a national archive entry: plain, declarative, unembellished. Avoid marketing language ("amazing," "seamless," "empower").

## Color palette

Derived directly from the national flag (deep green field, white stripe) and the coat of arms (gold/bronze heraldry, dark ink outlines). Defined as CSS custom properties in `assets/css/tokens.css` — always reference the token, never hardcode a hex value in new CSS.

| Token | Hex | Use |
|---|---|---|
| `--color-green-900` | `#0a3324` | Darkest green — footer, deep hover states |
| `--color-green-800` | `#0f4b32` | **Primary** — header bar, primary buttons/links |
| `--color-green-700` | `#146146` | Hover state for primary green surfaces |
| `--color-green-600` | `#1c7a58` | Reserved for lighter accents if ever needed |
| `--color-white` | `#ffffff` | Card surfaces |
| `--color-cream` | `#f7f5ef` | Page background (avoids stark-white fatigue) |
| `--color-cream-dark` | `#efe9da` | Alternate section background |
| `--color-gold-700` | `#82632c` | Muted gold — link-hover, small text accents |
| `--color-gold-600` | `#9b7735` | **Primary accent** — borders, tile icons, badges |
| `--color-gold-500` | `#b58c3f` | Mid gold, interpolation only |
| `--color-gold-400` | `#d8a537` | Hover state for gold elements |
| `--color-gold-300` | `#ecc219` | Brightest gold — use *sparingly*: badges, focus rings, small highlights only |
| `--color-ink-900` | `#171717` | Body text |
| `--color-ink-600` | `#473921` | Muted/secondary text |
| `--color-border` / `--color-border-strong` | `#d8d2c4` / `#b9ad91` | Hairline borders |

**Rule:** gold is an accent, not a body-text color. `--color-gold-600`/`700` on white passes contrast for borders, icons, and large serif headings, but body copy always stays `--color-ink-900`. Bright gold (`--color-gold-300`) is a highlight color used in small doses (a badge, a focus ring) — never as a large fill or a text color on a light background.

## Typography

Zero-dependency system font stacks only — no web fonts, no external font CDN. This keeps the site truly static and droppable on any host without a network dependency.

- **Serif** (`--font-serif`: Georgia / Times New Roman / serif) — all headings, the motto, document/legal text (Constitution, History). Evokes an official seal / printed-record feel.
- **Sans** (`--font-sans`: Segoe UI / system-ui / sans-serif) — body copy, navigation, UI chrome, buttons.

Don't introduce a third typeface family. If the brand ever needs a display font for something like a masthead, treat that as a deliberate exception to discuss first, not a default.

## Imagery — read this before adding any new photo or graphic

This project has two categories of imagery, and they are used in **very different ways**. Getting this distinction right matters more than any other rule in this guide.

### 1. Heraldic/vector assets (flag, coat of arms) — used as literal content
The flag and coat-of-arms SVGs (`assets/img/coat-of-arms-primary.svg`, `coat-of-arms-alt.svg`, `flag-rhodesia.svg`, and the derived `favicon.svg`/`favicon.png`) are official symbols. They are used **as themselves**, clearly and legibly: the header crest, the footer watermark, the favicon. This is appropriate — a coat of arms is *supposed* to be a recognizable, literal mark.

### 2. In-world photography (Roblox screenshots) — used as ambient design texture only, never as a featured component
`assets/img/scenery/` holds screenshots from the community's Roblox recreation of Rhodesia (government buildings, a courtroom, a parliamentary chamber, street scenes, a memorial). These are useful set-dressing, but **they must not become a visible "feature"** of the page — no photo galleries, no "hero banner photo" treatments, no card thumbnails, no page-header background photos presented at full clarity. That was tried once and explicitly rejected by the site owner: the instruction was "make it be part of the design, not be an actual component of the website."

What that means in practice:
- Acceptable: a single photo blended into a background at low opacity (roughly 30–35%), desaturated (`grayscale`), and blended (`mix-blend-mode: soft-light` or similar) so it reads as ambient texture behind the green gradient — the current hero treatment in `components.css` (`.hero::before`) is the reference implementation. It should never be sharp, in full color, or the visual focal point of the section.
- Not acceptable: an `<img>` tag showing the screenshot plainly as a discrete visual element the user's eye lands on — no "gallery" sections, no featured/hero photo cards, no photo thumbnails on agency or news cards, no full-clarity page-header backgrounds.
- If asked to "use the photos," default to the low-opacity ambient-texture treatment, not a literal photo feature. If genuinely unsure whether a proposed use crosses the line, ask before implementing — this has been corrected once already.

## Layout & component conventions

- **CSS load order** on every page: `tokens.css` → `base.css` → `layout.css` → `components.css`. Keep new styles in the file that matches its scope (tokens = variables only, layout = header/nav/footer/page-header, components = reusable UI pieces like cards/tiles/notices).
- **No build step.** Plain HTML/CSS/vanilla JS, no framework, no bundler, no npm. Every page includes only the JS it actually uses (`nav.js` everywhere; `search.js` on pages with filterable lists; `chapter-nav.js` only on `constitution.html`/`history.html`).
- **Page shell:** utility bar → green header with crest + wordmark + nav → page content → green footer with crest watermark, motto, link columns, and the fictional-content disclaimer. Every interior page repeats this shell exactly; don't fork it per-page.
- **Cards:** white surface, `--shadow-card`, gold-600 accent (border or icon), lift + gold-300 border on hover. This pattern covers service tiles, notice cards, and agency-directory cards — reuse it rather than inventing a new card style.
- **Document pages** (Constitution, History): sticky sidebar chapter/article nav with scrollspy (`chapter-nav.js`), verbatim source text, clause numbering preserved exactly as in the founding documents — these are transcriptions, not paraphrases. Don't summarize or edit the legal/historical text without being asked to.

## Content rules

- Don't invent new "features" (galleries, dashboards, forms that submit somewhere) without checking — this is a static informational/lore site, not an application. Service tiles, if reintroduced, should be treated as intentionally deferred (they were removed at the owner's request because that feature is being handled separately via Discord/Roblox integration) — don't re-add them without being asked.
- Keep the fictional-content footer disclaimer on every page.
- When adding new agencies/news/history content, stay consistent with the existing Constitution and History documents (article numbers, chapter structure, timeline dates) rather than contradicting established lore.
