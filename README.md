# vibe-eam
## Projektorganisation

Für dieses Projekt nutzen wir ein Kanban-Board zur strukturierten Aufgabenverwaltung. Findet man bei dem Punkt Projects -> EAM-Tool Teamproject

Google-Drive Projektordner:
https://drive.google.com/drive/folders/10orvVkPYZh6HlOfKTpdk3FgJpIZlQ_Tu?usp=drive_link
 
# EAM Tool Monorepo Setup

Dieses Projekt nutzt pnpm Workspaces zur Verwaltung von Backend (NestJS) und Frontend (React).

## Systemvoraussetzungen
- Node.js (v18+)
- pnpm

## Installation
Führe diesen Befehl im Hauptverzeichnis aus:
pnpm install

## Entwicklung (Localhost)

### Beide Anwendungen gleichzeitig starten
Um Backend und Frontend parallel zu starten, nutze:
pnpm dev

Hinweis: Erfordert folgendes Skript in der Root package.json:
"scripts": {
  "dev": "pnpm -r --parallel run dev"
}

### Anwendungen einzeln starten
- Backend (API): pnpm --filter api run start:dev 
- (Standard: Port 3000)
- Frontend (Web): pnpm --filter web run dev 
- (Standard: Port 5173)

## Wichtige Befehle
- Paket zu Backend hinzufügen: pnpm add [name] --filter api
- Paket zu Frontend hinzufügen: pnpm add [name] --filter web
- Workspace aufräumen: pnpm -r exec rm -rf node_modules

## Projektstruktur
/apps/api - NestJS Backend
/apps/web - React Frontend (Vite)
pnpm-workspace.yaml - Konfiguration der Workspace-Pakete