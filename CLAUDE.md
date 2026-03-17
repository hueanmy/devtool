# CLAUDE.md — DevToolKit

## Project Overview

DevToolKit is a **local-first, privacy-focused developer toolkit** that runs entirely in the browser. No server, no accounts, no tracking. Built by Coding4Pizza.

## Tech Stack

- **React 19** + **TypeScript** (JSX) — UI framework
- **Vite** — Dev server (port 3000) and bundler
- **Tailwind CSS v4** — Styling via PostCSS (not CDN)
- **Font Awesome 6** (CDN) + **Lucide React** — Icons
- **Inter** + **Fira Code** — Fonts (Google Fonts CDN)

## Commands

```bash
npm run dev          # Start dev server on port 3000 with HMR
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Vitest (unit tests)
npm run test:e2e     # Playwright (e2e tests)
```

## Project Structure

```
├── App.tsx                  # Main app — routing, layout, left sidebar nav
├── index.tsx                # React entry point
├── index.html               # HTML shell with loading screen
├── index.css                # Global styles (Tailwind)
├── types.ts                 # Shared TypeScript types
├── components/
│   ├── DataFormatter.tsx    # Convert lists → SQL IN/VALUES/UNION/CSV
│   ├── ListCleaner.tsx      # Dedup, sort, trim, compare lists
│   ├── SqlFormatter.tsx     # Format/minify SQL with dialect support
│   ├── JsonTools.tsx        # Format/minify/repair/diff/tree/TS interface gen
│   ├── MarkdownPreview.tsx  # Live GFM markdown editor + preview
│   ├── StackTraceFormatter.tsx  # Parse stack traces (.NET/JS/Java/Python/Go/Ruby)
│   ├── MockDataGenerator.tsx    # Generate fake data (JSON/CSV/SQL) via faker.js
│   ├── JwtDecode.tsx        # JWT token decoder with syntax highlighting
│   ├── QueryPlanViewer.tsx  # SQL Server execution plan viewer + Gemini AI analysis
│   ├── MetadataExplorer.tsx # Binary file metadata display
│   ├── MetadataSidebar.tsx  # Metadata sidebar panel
│   ├── DropZone.tsx         # File drop zone for metadata tool
│   ├── MetadataCard.tsx     # Metadata card component
│   ├── CopyButton.tsx       # Reusable copy-to-clipboard button
│   ├── ResizableSplit.tsx   # Resizable split pane component
│   ├── LandingPage.tsx      # (unused) Landing page
│   └── PrivacyPage.tsx      # Privacy policy page
├── utils/
│   ├── exifParser.ts        # EXIF/metadata extraction via WebAssembly
│   ├── formatter.ts         # Formatting utilities
│   ├── metadataUtils.ts     # Metadata helper functions
│   └── mockDataGenerator.ts # Faker.js data generation logic
├── lib/
│   └── SQLPlanAnalyzer.ts   # SQL execution plan parser/analyzer
└── tests/
    ├── setup.ts             # Test setup (vitest + jsdom)
    └── integration/
        └── MarkdownPreview.test.tsx
```

## Architecture

- **SPA with tab-based routing** — `App.tsx` manages `AppMode` state, renders selected tool via conditional rendering
- **Lazy loading** — All tool components use `React.lazy()` + `Suspense` for code splitting
- **Tab persistence** — Last active tab saved to `localStorage` (`devtoolkit:lastTab`)
- **No router library** — Navigation is state-driven, no URL routing
- **Path alias** — `@/*` maps to project root

## Key Libraries

| Library | Purpose |
|---------|---------|
| `sql-formatter` | SQL formatting/minification |
| `jsonrepair` | Auto-repair malformed JSON |
| `@faker-js/faker` | Mock data generation |
| `@uswriting/exiftool` | Binary metadata extraction (WASM) |
| `@google/genai` | Gemini AI for SQL plan analysis (opt-in, user API key) |
| `html-query-plan` | SQL Server execution plan rendering (patched in vite.config.ts) |
| `react-markdown` + `remark-gfm` | Markdown preview |
| `mermaid` | Diagram rendering |
| `@6over3/zeroperl-ts` | Perl WASM runtime for ExifTool |

## Conventions

- Components are `.tsx` files in `components/`, one component per file
- Utility/logic files in `utils/` and `lib/`
- Shared types in `types.ts`
- Styling: Tailwind utility classes inline, no CSS modules
- All tools are self-contained components with their own state
- No global state management (no Redux/Zustand) — each tool manages its own state via `useState`
