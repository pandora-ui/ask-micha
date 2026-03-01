# Micha MVP Monorepo

Minimaler, aber produktionsnaher Intelligence-Stack mit:

- Nuxt 3 Web App (BFF, kein Token im Browser)
- Worker (Pilot/Manual/Scheduled)
- Directus + Postgres
- AJV-validierten Schemas
- deterministischem Scoring
- Multi-Goal-System mit goal-spezifischen Runs

## Dokumentation

- Ausführliche Projekt-Dokumentation: [REPO_GUIDE.md](./REPO_GUIDE.md)

## Architektur auf einen Blick

- `apps/web`: Dashboard + Wizard + Server-API-Routen
- `apps/worker`: Fetch/Normalize/Rank/Report Pipeline
- `packages/schemas`: JSON Schema + Validatoren
- `packages/shared`: Directus Client, Dedupe, Scoring, Defaults
- `scripts`: Setup/Provision/Seed

## Voraussetzungen

- Node.js >= 20
- pnpm >= 10
- Docker

## Environment

```bash
cp .env.example .env
```

Wichtig:

- `DIRECTUS_URL`
- `DIRECTUS_ADMIN_TOKEN`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (z. B. `gpt-4.1-mini`)

## Setup (einmalig / bei frischer DB)

```bash
pnpm install
pnpm setup
```

`pnpm setup` macht:

1. Docker Services hochfahren
2. Auf Directus warten
3. Collections + Felder provisionieren
4. Seed-Daten schreiben

## Usage (täglicher Betrieb)

```bash
pnpm dev
```

Danach:

- Dashboard: `http://localhost:3000`
- Quellen: `http://localhost:3000/sources`
- Wizard: `http://localhost:3000/wizard`
- Hilfe: `http://localhost:3000/help`
- Directus: `http://localhost:8055`

## Dashboard

Home (`/`) ist ein zweispaltiges Ops-Dashboard:

**Linke Sidebar — Goals**
- Listet alle angelegten Goals (Name + Versionsnummer)
- Aktives Goal ist hervorgehoben (fett + Punkt)
- Klick auf Goal → wechselt Watch Panel und Executive Brief auf dieses Goal
- `✏` → öffnet Wizard zur Bearbeitung des Goals
- `🗑` → löscht alle Versionen des Goals (Bestätigung erforderlich)
- `+ New Goal` → öffnet Wizard für ein neues Goal

**Rechter Hauptbereich**
1. Run Controls — Pilot/Manual Run starten + Stat-Tiles (letzter Run, Kandidaten, Top Items)
2. Live Terminal — erscheint während eines aktiven Runs (MacOS-style, Auto-Scroll)
3. Executive Brief — Headline/Key Message + Executive Summary + Top Highlights des aktiven Goals
4. Run History — Tabelle vergangener Runs (aufklappbar → zeigt Top Items des jeweiligen Runs)
5. Setup & Danger Zone (im Setup-Tab)

### Live-Run Mechanik

Beim Klick auf `Start ... Run`:

1. Web API startet den Worker-Prozess mit dem aktiven Goal als `--goal-name`-Argument
2. stdout/stderr werden serverseitig gesammelt
3. Dashboard pollt den Job-Status jede Sekunde
4. Ergebnisse streamen live ins UI (STREAM_ITEM-Events)

Relevante Dateien:

- `apps/web/server/utils/run-jobs.ts`
- `apps/web/server/api/runs/start.post.ts`
- `apps/web/server/api/runs/jobs/[id].get.ts`
- `apps/web/server/api/runs/history.get.ts`

### Goal-spezifische Ergebnisse

Jeder Run ist mit dem aktiven Goal verknüpft (`goal_name` wird in `report_json` gespeichert).
Der Executive Brief und die Highlights filtern automatisch auf das in der Sidebar gewählte Goal.
Wechselt man das Goal, wechseln auch die angezeigten Ergebnisse.

## Wizard (`/wizard`)

Der Wizard dient zur Erstellung und Bearbeitung von Goals:

- **Formular-basiert** (kein Step-by-Step, keine AI-Generierung)
- Quick-Template Chips für schnellen Start: General Watch, AI & Tech, Engineering, GTM, Science & Research, Security & Privacy
- Felder: Goal Name, Focus Keywords (Tag-Input), Excluded Topics, Required Keywords, Target Audience, Lookback Days, Max Items
- Speichert als neue GoalSpec-Version in `ai_goal_specs`
- Nach dem Speichern: Redirect zurück zu `/?goal=<name>`

**Bearbeitung eines bestehenden Goals:**

```
/wizard?goal=<goalName>
```

Das Formular wird mit den aktuellen Werten vorausgefüllt.

## Worker Modi (CLI)

```bash
pnpm --filter @mvp/worker pilot
pnpm --filter @mvp/worker manual
pnpm --filter @mvp/worker schedule
```

Verbose:

```bash
pnpm --filter @mvp/worker pilot -- --verbose
```

Goal explizit angeben:

```bash
pnpm --filter @mvp/worker pilot -- --goal-name "AI Strategy Watch"
```

Scheduler: Montag 09:00 `Europe/Berlin` (aus `ai_projects` in Directus).

## Datenmodell (MVP)

Zentrale Collections:

- `ai_goal_specs` — versionierte Goals (name, version, goal_json)
- `ai_source_policies` — versionierte Quellenlisten
- `ai_sources` — Snapshot der Quellen je Policy-Version
- `ai_runs` — Run-Metadaten (inkl. `report_json.goal_name`)
- `ai_run_items` — priorisierte Items pro Run
- `ai_discovery_answers` — veraltet (Legacy)
- `ai_feedback` — Item-Bewertungen

## Pipeline-Regeln

- Mindestens 2 Quellen (RSS + API)
- Dedupe + deterministisches Scoring
- Cite-or-omit: Top-Items nur mit mindestens 1 Citation URL
- LLM nur für Textgenerierung (Summary, Why, Risks)
- Goal wird per Name aus Directus geladen (`--goal-name`-Arg), Fallback: neueste Version

## Tests

```bash
pnpm --filter @mvp/schemas test
pnpm --filter @mvp/worker test
pnpm --filter @mvp/web test
```

## Troubleshooting

### Kein Live-Log im Dashboard

- prüfen, ob Web-Prozess neu gestartet wurde (`pnpm dev`)
- prüfen, ob `apps/web/server/utils/run-jobs.ts` vorhanden ist
- prüfen, ob Worker per CLI einzeln läuft

### `Missing Directus runtime config`

- `.env` prüfen
- Web neu starten

### `invalid model ID`

- `OPENAI_MODEL` auf gültiges Modell setzen

### Run bleibt auf `running`

Ursache: offene HTTP-Verbindungen im Worker (Directus/OpenAI Connection Pool).
Fix ist bereits implementiert: Worker-Prozess ruft `process.exit(0)` nach erfolgreichem Run.
Zusätzlich: `run-jobs.ts` erkennt `"Run complete:"` in stdout und setzt Status sofort auf `completed`.

### Ergebnisse zeigen falsches Goal

Prüfen ob `goal_name` korrekt im `report_json` des Runs steht (Directus → `ai_runs` → `report_json`).
Falls leer: Run mit aktivem Goal erneut starten.

## Reset (lokal)

```bash
pnpm docker:down
docker volume rm micha-mvp_postgres_data
pnpm setup
```

## Quellenverwaltung (`/sources`)

- Listet alle konfigurierten RSS/API-Quellen mit Enabled-Toggle und Gewichtung
- Quellen aktivieren/deaktivieren ohne Neustart — jede Änderung erzeugt eine neue SourcePolicy-Version
- Neue Quelle hinzufügen: URL eingeben → `Validate` prüft live ob es ein gültiger RSS/Atom-Feed ist → dann hinzufügen
- Quellen löschen (mind. 2 müssen aktiv bleiben)

Weitere Quellen ergänzen:

1. in `packages/shared/src/defaults.ts` unter `defaultSourcePolicy().sources`
2. in `scripts/seed.ts` im `defaultPolicy.sources`-Block
3. danach `pnpm seed` ausführen

## Release Notes Script

```bash
pnpm release:notes
pnpm deploy:notes
```

Beide führen `scripts/release-note.sh` aus und erzeugen `RELEASE_NOTES.md`.

```bash
./scripts/release-note.sh --count 30
./scripts/release-note.sh --since "14 days ago" --output RELEASE_NOTES.md
```
