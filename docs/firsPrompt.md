# First Prompt for Repo-Architecture and Tooling Enviroment

### Repo Structure from Gemini

vibe-eam/
├─ apps/
│  ├─ web/              # React Frontend
│  │  ├─ src/           # <--- HIER (main.tsx, App.tsx, components/...)
│  │  ├─ index.html
│  │  └─ package.json
│  └─ api/              # NestJS Backend
│     ├─ src/           # <--- HIER (main.ts, app.module.ts, ...)
│     └─ package.json
├─ packages/
│  ├─ core/             # Shared Logic & ArchiMate Types
│  │  ├─ src/           # <--- HIER (index.ts, validation.ts)
│  │  └─ package.json
│  ├─ ui/               # Shared UI Components (MUI)
│  │  ├─ src/           # <--- HIER (Button.tsx, Layout.tsx)
│  │  └─ package.json
│  └─ config/           # Shared Config (kein src nötig, nur .json/.js Dateien)
├─ docs/                # Dokus für die Entwicklung 
├─ pnpm-workspace.yaml
├─ package.json
└─ README.md

## pnpm
Ist es schwer zu lernen?
Nein! Die Befehle sind fast identisch:

Statt npm install schreibst du pnpm install (oder kurz pnpm i).

Statt npm run dev schreibst du pnpm dev.

Statt npm install react schreibst du pnpm add react.

Zusammenfassung für dein Team:
"Wir nutzen pnpm, weil es schneller ist, weniger Speicher braucht und unser Monorepo sauberer verwaltet als das klassische npm.