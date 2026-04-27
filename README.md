# vibe-eam
## Projektorganisation

Für dieses Projekt nutzen wir ein Kanban-Board zur strukturierten Aufgabenverwaltung. Findet man bei dem Punkt Projects -> EAM-Tool Teamproject

Google-Drive Projektordner:
https://drive.google.com/drive/folders/10orvVkPYZh6HlOfKTpdk3FgJpIZlQ_Tu?usp=drive_link

## Prototype (Web-App) starten

### Voraussetzungen
- Node.js (inkl. npm)
- Docker Desktop (für Postgres)

### Setup

```bash
cd vibe-eam
npm install

# Postgres starten (Docker Desktop muss laufen)
npm run db:up

# Prisma Migration + Client erzeugen
npm run prisma:migrate -w @vibe-eam/api
npm run prisma:generate -w @vibe-eam/api
```

### Dev-Start (API + Web)

```bash
npm run dev
```

- Web: meist `http://localhost:5173` (falls belegt, nimmt Vite automatisch z. B. `5174` – steht dann im Terminal-Output)
- API: `http://localhost:3000`

### Nutzung (MVP)
- Links im **Palette**-Bereich ein Element **per Drag&Drop** aufs Canvas ziehen.
- Kanten erzeugen: **Node → Node verbinden** (erstellt Relation).
- **Auto‑layout**: ordnet das Modell automatisch an.
- **Heatmap**: Attribut-Key eingeben (z. B. `cost` oder `risk`) → Nodes werden eingefärbt.
- **CSV Export**: kopiert Elements+Relations CSV in die Zwischenablage.
