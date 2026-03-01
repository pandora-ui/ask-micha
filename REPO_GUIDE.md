# Micha MVP Repository Guide

## Ziel des Repos

Dieses Repository ist ein monorepo-basierter Intelligence-Stack, der beliebige Signalquellen (RSS-Feeds, APIs) einsammelt, bewertet und in verwertbare Ergebnisse überführt.

Der Fokus liegt auf:

- reproduzierbarer Datenpipeline (Fetch → Dedupe → Ranking → Insights → Persistenz)
- klarer Trennung zwischen Web-UI, Worker und Shared-Logik
- flexibler Konfiguration von mehreren Goals und Quellen direkt im Dashboard

## Architektur

### Apps

- `apps/web`
  - Nuxt 3 Web-App
  - Dashboard mit Goals-Sidebar, Executive Brief, Live-Terminal und Run-Historie
  - Server-API-Routen als BFF-Layer (Goals, Sources, Runs)
  - Startet Worker-Runs als Child-Prozess und zeigt Live-Logs/Run-Historie
  - Nitro-Plugin (`server/plugins/migrate.ts`) für automatische Schema-Migration beim Start

- `apps/worker`
  - CLI-Worker für `pilot`, `manual`, `schedule`
  - Führt die Pipeline aus (Quellen abrufen, score-basiert priorisieren, Report erstellen)
  - Persistiert Runs und Items in Directus
  - Im `schedule`-Modus liest der Worker seinen Cron-Ausdruck aus `ai_projects` in Directus
  - Unterstützt `--goal-name <name>` CLI-Argument für goal-spezifische Runs

### Packages

- `packages/schemas`
  - JSON-Schemas + Validatoren (AJV-basiert)
  - `GoalSpec`: Suchziel, Keywords, Lookback-Zeitraum
  - `SourcePolicy`: Quellenliste mit Gewichtung und Enabled-Flag

- `packages/shared`
  - gemeinsame Utilities (Directus-Client, Defaults, Ranking, Dedupe)
  - von Web und Worker gemeinsam verwendet

### Externe Services

- Directus + Postgres (Konfiguration, Runs, Items)
- OpenAI API (Executive Summary, Why-it-matters, Risks je Item)

## Kernkonzepte

- `GoalSpec`: beschreibt das Suchziel — Name, Keywords, Ausschlüsse, Lookback-Tage, Max-Items. Versioniert in `ai_goal_specs`.
- `SourcePolicy`: definiert RSS/API-Quellen mit Gewicht und Enabled-Flag. Jede Änderung erzeugt eine neue Version in `ai_source_policies`.
- `ai_projects`: speichert Cron-Ausdruck und Zeitzone für automatische Runs. Wird beim Dashboard-Start geladen.
- `Run`: einzelne Ausführung der Pipeline (`pilot`, `manual`, `scheduled`)
- `Run Items`: priorisierte Ergebnisse pro Run

### Multi-Goal-System

Jeder Run ist einem Goal zugeordnet. Das aktive Goal wird im Dashboard (Sidebar) gewählt und beim Run-Start als `--goal-name`-Argument an den Worker übergeben. Der Worker lädt den GoalSpec per Name aus Directus und speichert den Namen im `report_json.goal_name`-Feld des Runs.

Die `highlights`-API filtert Runs auf Basis von `report_json.goal_name` (JavaScript-seitig, ohne Directus-Query-Filter), damit kein Schema-Change erforderlich ist.

### Scoring-Logik

Jedes Item erhält einen deterministischen Score aus drei Komponenten:

```
score = recency × 0.4 + relevance × 0.4 + source_trust × 0.2
```

- **Recency**: wie aktuell ist das Item relativ zum Lookback-Zeitraum?
- **Relevance**: wie viele der definierten Keywords treffen zu? Sind keine Keywords gesetzt, gilt jedes Item als voll relevant (1.0).
- **Source Trust**: Gewichtung der Quelle aus der aktiven SourcePolicy.

## Voraussetzungen

- Node.js >= 20
- pnpm >= 10
- Docker

## Setup (lokal)

1. Environment anlegen:

```bash
cp .env.example .env
```

2. Dependencies installieren:

```bash
pnpm install
```

3. Infrastruktur + Provisioning + Seed:

```bash
pnpm setup
```

`pnpm setup` führt aus:

- Docker-Services starten
- auf Directus warten
- Collections/Felder provisionieren
- Seed-Daten schreiben (Default-Projekt + SourcePolicy mit 27 Quellen, 6 davon aktiv)

## Wichtige Environment-Variablen

- `DIRECTUS_URL`
- `DIRECTUS_ADMIN_TOKEN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Entwicklung und Nutzung

### Alles lokal starten

```bash
pnpm dev
```

Danach:

- Dashboard: `http://localhost:3000`
- Quellen: `http://localhost:3000/sources`
- Wizard: `http://localhost:3000/wizard`
- Hilfe: `http://localhost:3000/help`
- Directus: `http://localhost:8055`

### Dashboard — Übersicht

Das Dashboard (`/`) hat ein zweispaltiges Layout:

**Linke Sidebar — Goals**
- Listet alle Goals (Name + Version), gruppiert nach Name (jeweils neueste Version)
- Aktives Goal: fett + blauer Punkt; Klick auf einen anderen Namen → wechselt Watch Panel + Executive Brief
- `✏` → öffnet Wizard vorausgefüllt mit aktuellem Goal (`/wizard?goal=<name>`)
- `🗑` → löscht alle Versionen dieses Goals aus `ai_goal_specs` (Bestätigung erforderlich; letztes Goal kann nicht gelöscht werden)
- `+ New Goal` → öffnet Wizard leer

**Rechter Hauptbereich**
1. **Run Controls** — Pilot / Manual Run starten + Stat-Tiles (letzter Run, Kandidaten, Top Items, generierte Items)
2. **Live Terminal** — erscheint während eines aktiven Runs (MacOS-style Terminal, Auto-Scroll, STREAM_ITEM-Parsing)
3. **Executive Brief** — Headline + Key Message + Executive Summary + Critical Updates + Top-Highlights des **aktiven Goals**
4. **Run History** — Tabelle vergangener Runs (klickbar → expandiert → zeigt Top Items des jeweiligen Runs)

**Setup-Bereich** (Tab)
- Setup-Schritte + Recovery Cards
- Danger Zone: "Reset All Results" — löscht `ai_runs`, `ai_run_items`, `ai_sources` (erfordert "RESET RESULTS"-Bestätigung)

### Goal-spezifische Ergebnisse

- Aktives Goal wird in `localStorage` (`activeGoalName`) gespeichert
- URL-Param `?goal=<name>` beim Laden des Dashboards wird berücksichtigt (Redirect aus Wizard)
- `useFetch` für Goal-Daten und Highlights nutzt Arrow-Function-URLs (nicht computed refs), damit Nuxt 3 bei Änderungen des aktiven Goals automatisch neu fetcht
- `setActiveGoal(name)` ruft `refreshGoal()` + `refreshHighlights()` parallel auf

### Wizard (`/wizard`) — Goal-Editor

Der Wizard dient zur Erstellung und Bearbeitung von Goals:

- **Formular-basiert** (kein Step-by-Step, keine AI-Generierung)
- Quick-Template Chips: General Watch, AI & Tech, Engineering, GTM, Science & Research, Security & Privacy
- Felder: Goal Name, Focus Keywords (Tag-Input), Excluded Topics, Required Keywords, Target Audience, Lookback Days, Max Items
- Speichert als neue GoalSpec-Version in `ai_goal_specs`
- Nach dem Speichern: Redirect zu `/?goal=<name>`

**Bearbeitung eines bestehenden Goals:**

```
/wizard?goal=<goalName>
```

Das Formular wird mit dem aktuellen GoalSpec vorausgefüllt (lazy fetch via `/api/goals/latest?name=<name>`).

### Quellenverwaltung (`/sources`)

- Listet alle konfigurierten RSS/API-Quellen mit Enabled-Toggle und Gewichtung
- Quellen aktivieren/deaktivieren ohne Neustart — jede Änderung erzeugt eine neue SourcePolicy-Version
- Neue Quelle hinzufügen: URL eingeben → `Validate` prüft live ob es ein gültiger RSS/Atom-Feed ist → dann hinzufügen
- Quellen löschen (mind. 2 müssen aktiv bleiben)

**Standardmäßig aktive Quellen (6):**

| ID | Name |
|---|---|
| `hn_rss` | Hacker News (RSS) |
| `hn_api` | Hacker News API |
| `lobsters_rss` | Lobsters |
| `github_blog` | GitHub Blog |
| `a16z_blog` | a16z Blog |
| `product_hunt` | Product Hunt |

21 weitere Quellen (ArXiv, OpenAI, Anthropic, etc.) sind vorhanden aber deaktiviert.

### Worker manuell per CLI starten

```bash
pnpm --filter @mvp/worker pilot
pnpm --filter @mvp/worker manual
pnpm --filter @mvp/worker schedule
```

Mit spezifischem Goal:

```bash
pnpm --filter @mvp/worker pilot -- --goal-name "AI Strategy Watch"
```

Verbose:

```bash
pnpm --filter @mvp/worker manual -- --verbose
```

Im `schedule`-Modus liest der Worker Cron-Ausdruck und Zeitzone aus der `ai_projects`-Collection in Directus. Fallback: `0 9 * * 1` (Montag 09:00 Europe/Berlin).

## API-Routen (BFF)

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/goals` | GET | Alle Goals laden (gruppiert nach Name, je neueste Version) |
| `/api/goals/latest` | GET | Neueste GoalSpec laden; `?name=<n>` für spezifisches Goal |
| `/api/goals/update` | POST | Neue GoalSpec-Version speichern |
| `/api/goals/:name` | DELETE | Alle Versionen eines Goals löschen |
| `/api/sources` | GET | Quellenliste aus aktueller SourcePolicy |
| `/api/sources` | POST | Neue Quelle hinzufügen (neue Policy-Version) |
| `/api/sources/:id` | PATCH | Quelle aktivieren/deaktivieren oder Gewicht ändern |
| `/api/sources/:id` | DELETE | Quelle entfernen |
| `/api/sources/validate` | POST | RSS/Atom-Feed-URL live validieren |
| `/api/runs/start` | POST | Run starten (spawnt Worker-Child-Prozess); `goalName` im Body |
| `/api/runs/history` | GET | Run-Historie (letzte 20 Runs) |
| `/api/runs/highlights` | GET | Highlights des letzten Runs; `?goal=<name>` für spezifisches Goal |
| `/api/runs/:run_key/highlights` | GET | Highlights eines bestimmten Runs |
| `/api/runs/jobs/:id` | GET | Job-Status pollen |
| `/api/admin/reset-results` | POST | Alle Ergebnis-Collections löschen (erfordert Bestätigung) |

## Datenfluss der Pipeline

1. `GoalSpec` aus Directus laden — per Name (`listByName`) wenn `--goal-name` gesetzt, sonst neueste Version (`listLatest`)
2. `SourcePolicy` (neueste Version) aus Directus laden
3. Sources-Snapshot in `ai_sources` materialisieren
4. aktive Quellen abrufen (RSS/API)
5. Dedupe anwenden (by URL + by Title)
6. deterministisch ranken (recency + relevance + source_trust)
7. Cite-or-omit: nur Items mit mindestens einer Citation URL behalten
8. Top-Items auswählen (`maxItems` aus CLI-Arg oder GoalSpec)
9. OpenAI-Insights erzeugen (Executive Summary + Item-Insights)
10. Run in Directus speichern — `goal_name` in **beiden** Feldern: Top-Level-Feld (`goal_name`) und im `report_json.goal_name`
11. Items in `ai_run_items` speichern
12. Dashboard zeigt Highlights und Historie

### Goal-Name Übergabe (End-to-End)

```
Browser (activeGoalName)
  → POST /api/runs/start { goalName }
  → startRunJob(mode, verbose, maxItems, goalName)
  → Worker spawn: node cli.ts pilot --goal-name "AI Strategy Watch"
  → parseCliArgs() → { goalName: "AI Strategy Watch" }
  → runPipeline({ ..., goalName })
  → directus.listByName("ai_goal_specs", goalName, "goal_json")
  → createRun({ ..., goal_name: goalSpec.name, report_json: { goal_name: goalSpec.name, ... } })
```

### report_json.goal_name — Design-Entscheidung

Das `goal_name`-Feld wird sowohl als Top-Level-Feld in `ai_runs` als auch innerhalb von `report_json` gespeichert. Die Filter-Logik in `highlights.get.ts` nutzt `report_json.goal_name` (JavaScript-seitig), weil Directus-Query-Filter auf neuen Feldern fehlschlagen können, wenn das Schema-Migration noch nicht vollständig durchgelaufen ist. So ist die Filterung robust ohne Schema-Abhängigkeit.

## Datenmodell (wichtigste Collections)

| Collection | Inhalt |
|---|---|
| `ai_goal_specs` | Versionierte GoalSpec-Records (name, version, goal_json) |
| `ai_source_policies` | Versionierte SourcePolicy-Records |
| `ai_projects` | Schedule-Konfiguration (Cron, Zeitzone, enabled) |
| `ai_sources` | Snapshot der Quellen je Policy-Version |
| `ai_runs` | Run-Metadaten (run_key, mode, status, goal_name, report_markdown, report_json) |
| `ai_run_items` | Priorisierte Items pro Run |
| `ai_discovery_answers` | Veraltet (Legacy-Wizard) |
| `ai_feedback` | Item-Bewertungen |

## Schema-Migration

Beim Start des Nuxt-Servers führt das Nitro-Plugin `apps/web/server/plugins/migrate.ts` automatisch `directus.ensureSchema()` aus. Dies legt fehlende Collections und Felder an, ohne bestehende Daten zu verändern. So sind auch bestehende Instanzen nach einem Update ohne manuellen Eingriff korrekt.

## Wichtige Dateien

| Datei | Zweck |
|---|---|
| `apps/web/pages/index.vue` | Haupt-Dashboard (Goals-Sidebar, Run Controls, Executive Brief, History) |
| `apps/web/pages/wizard.vue` | Goal-Editor (Formular, Templates, `?goal=` URL-Param) |
| `apps/web/pages/sources.vue` | Quellenverwaltung |
| `apps/web/pages/help.vue` | Hilfe-Seite |
| `apps/web/server/utils/run-jobs.ts` | In-Memory Job-Store + Child-Prozess-Spawner |
| `apps/web/server/api/runs/start.post.ts` | Run starten (inkl. goalName-Weiterleitung) |
| `apps/web/server/api/runs/highlights.get.ts` | Highlights des letzten Runs (goal-gefiltert) |
| `apps/web/server/api/goals/index.get.ts` | Alle Goals laden (gruppiert) |
| `apps/web/server/api/goals/latest.get.ts` | Neueste GoalSpec (optional nach Name gefiltert) |
| `apps/web/server/api/goals/[name].delete.ts` | Goal löschen |
| `apps/web/server/plugins/migrate.ts` | Automatische Schema-Migration beim Start |
| `apps/worker/src/cli.ts` | Worker-Einstiegspunkt (arg-Parsing inkl. `--goal-name`) |
| `apps/worker/src/core/pipeline.ts` | Haupt-Pipeline (Fetch → Rank → Insights → Persist) |
| `packages/shared/src/directus.ts` | Directus-Client (inkl. `listByName`, `createRun`) |
| `packages/shared/src/defaults.ts` | Default GoalSpec + SourcePolicy |
| `scripts/seed.ts` | Seed-Daten für frische Instanz |

## Tests

```bash
pnpm --filter @mvp/schemas test
pnpm --filter @mvp/worker test
pnpm --filter @mvp/web test
```

## Release / Commit Workflow

### Release Notes generieren

```bash
pnpm release:notes
```

### Stage + Commit + Release Notes automatisieren

```bash
pnpm run release:commit -- --message "feat: your message"
```

Optionen:

- `--count <n>` Anzahl Commit-Historie für Release Notes
- `--push` committete Änderungen direkt pushen
- `--dry-run` nur anzeigen, nichts ändern

Beispiel:

```bash
pnpm run release:commit -- --message "feat: multi-goal sidebar" --count 30
```

## Troubleshooting

### `Unexpected end of JSON input` bei Directus

Ursache ist oft ein leerer Response-Body bei Schreiboperationen (z. B. DELETE).
Im Shared Directus Client wird das bereits robust behandelt (leerer Body wird akzeptiert).

### Run bleibt auf `running`

Primärfix: Worker ruft `process.exit(0)` nach erfolgreichem `runOnce()` auf (offene HTTP-Handles von Directus/OpenAI).
Fallback: `run-jobs.ts` erkennt `"Run complete:"` in stdout und setzt `job.status = "completed"` sofort (ohne auf den `close`-Event zu warten).

### Ergebnisse zeigen falsches Goal

Prüfen ob `report_json.goal_name` im Directus-Run-Record gesetzt ist. Falls leer: Run mit aktivem Goal erneut starten. Schema-Migration läuft beim nächsten `pnpm dev` automatisch.

### Nuxt `#app-manifest` Importfehler

Meist Cache-/stale-process-Thema:

```bash
rm -rf apps/web/.nuxt apps/web/.output apps/web/node_modules/.cache node_modules/.cache/vite
pnpm --filter @mvp/web dev
```

### useFetch reagiert nicht auf Goal-Wechsel

Sicherstellen, dass die URL-Parameter als Arrow-Function übergeben werden (nicht als `computed` ref):

```typescript
// korrekt
useFetch(() => `/api/goals/latest?name=${activeGoalName.value}`, { key: "goalSpec" })

// falsch — re-fetch bei Goal-Wechsel nicht garantiert
const url = computed(() => `/api/goals/latest?name=${activeGoalName.value}`)
useFetch(url)
```

## Empfohlene tägliche Arbeitsweise

1. `pnpm dev` starten
2. Goal in der Sidebar wählen oder `+ New Goal` → Wizard
3. Quellen unter `/sources` konfigurieren (einmalig)
4. `Start Pilot Run` für sofortigen Run mit aktivem Goal
5. Ergebnisse in Executive Brief / History prüfen
6. Änderungen committen: `pnpm run release:commit -- --message "..."`
