# SQL-Werkstatt

Interaktive Lernwerkstatt zur Klausurvorbereitung **Datenaufbereitung & SQL**.
Erst verstehen, dann üben, dann unter Zeitdruck bestehen – komplett offline, im Browser, auf deinem eigenen Server.

- **8 Module** genau entlang der Prüfungsthemen – mit Lerneinheiten und ausführbaren Beispielen, inklusive des kompletten **Übungsblatts** aus dem Unterricht
- **199 Aufgaben** in 9 Typen: SQL schreiben, Fehler finden, Daten ändern (INSERT/UPDATE/DELETE), Ergebnis bestimmen, Ergebnistabelle ausfüllen, **Freitext mit Erwartungshorizont**, Auswahl, Zuordnen, Reihenfolge
- **Echte SQL-Engine** (SQLite als WebAssembly) – jede Abgabe wird gegen eine Musterlösung ausgeführt und verglichen, mit deutschen Fehlermeldungen und konkreten Tipps
- **Formelsammlung** – dieselbe, die in der Klausur erlaubt ist – jederzeit aufrufbar; Aufgaben mit Syntax darüber hinaus sind als *Vertiefung* markiert
- **Probeklausuren** (Übungsblatt-Klausur, 20 / 45 / 90 min) mit Timer, Papiermodus, Formelsammlung und IHK-Notenschlüssel
- **Wiederholung** nach Karteikasten-Prinzip (1 → 3 → 7 Tage) für alles, was noch nicht sitzt
- **Gamification**: XP, sechs Stufen vom *Lehrling* zum *Baumeister*, Lernserie, 16 Abzeichen, Klausurreife-Anzeige und Tagesplan bis zum Klausurtermin
- **Spielwiese** mit Schema-Browser, **Spickzettel** mit ER-Diagramm (druckbar)
- **Sync zwischen Geräten**: Lernstand wird auf dem Server gespeichert – am PC anfangen, am Handy weitermachen

| Bereich | Modul | Inhalt |
|---|---|---|
| Datenaufbereitung | 01 Datenqualität | Kriterien, Dubletten, Begründung der Bereinigung, DSGVO |
| | 02 Daten bereinigen | fehlend / ungültig / uneinheitlich / doppelt, Maßnahmen, Formate vereinheitlichen, auffällige Buchungen |
| | 03 Projektarbeit | Kanban (Pull-Prinzip, WIP-Limit, Simulator), Werkzeug je Datenwelt, Zusammenführung |
| SQL | 04 Abfragen schreiben | SELECT, WHERE, ORDER BY, LIMIT, DISTINCT, Rechnen mit Alias |
| | 05 Auswerten | Aggregatfunktionen, GROUP BY, HAVING |
| | 06 Mehrere Tabellen | PK/FK, JOINs über 2–4 Tabellen, LEFT JOIN, Unterabfragen, Ergebnisse vorhersagen |
| | 07 Daten ändern & Fehler finden | INSERT, UPDATE, DELETE, referentielle Integrität, Fehlerklassiker |
| Klausurvorbereitung | 08 Übungsblatt | Wiederholungsblatt aus dem Unterricht: Teil A (Freitext, Fitnessstudio), Teil B (SQL, Stadtbücherei), Zusatz IHK |

Es gibt zwei Übungsdatenbanken: einen fiktiven Baustoffhandel (Kunden, Artikel, Bestellungen, Buchungen mit eingebauten Auffälligkeiten und eine absichtlich „schmutzige“ Importtabelle) und die Stadtbücherei aus dem Übungsblatt (Buch, Verlag, Mitglied, Entleihe).

---

## Installation auf ZimaOS

Das fertige Image (`amd64` + `arm64`) baut GitHub Actions bei jedem Push: **`ghcr.io/pyzyi/sqlw:latest`**.

**ZimaOS:** App Store → **„+“** → **„Benutzerdefinierte App installieren“** → **„Importieren“** → Inhalt von [`docker-compose.yml`](docker-compose.yml) einfügen → installieren. Danach **`http://<zimaos-ip>:8095`** öffnen.

**Andere Systeme / Terminal:**

```sh
curl -fsSLO https://raw.githubusercontent.com/Pyzyi/sqlw/main/docker-compose.yml
docker compose up -d
```

Die Lernstände liegen unter `/DATA/AppData/sqlwork` auf dem Host. Der Container startet kurz als root, übergibt diesen Ordner an den Laufzeitbenutzer (UID 1000) und gibt danach alle Rechte ab – dafür braucht er nur `CHOWN`, `SETUID` und `SETGID`.

**Update:** In ZimaOS die App aktualisieren bzw. `docker compose pull && docker compose up -d`.

**Selbst bauen (optional):** `git clone https://github.com/Pyzyi/sqlw.git && cd sqlw && docker compose -f docker-compose.build.yml up -d --build`

### Fehler mit `1panel.live`, `daocloud.io` o. Ä.

ZimaOS weicht auf regionale Mirror-Server aus, wenn der Download von der Original-Registry fehlschlägt. Meldungen wie `ghcr.1panel.live: no such host` bedeuten also: Das Image war nicht erreichbar – meist ist das Paket auf GitHub noch nicht öffentlich (*Packages → sqlw → Package settings → Change visibility → Public*).

### Port ändern

In der Compose-Datei `"8095:8080"` anpassen – die linke Zahl ist der Port auf dem ZimaOS.

### Datensicherung

Einfach den Ordner `/DATA/AppData/sqlwork` sichern (z. B. mit der ZimaOS-Backup-Funktion).

Zusätzlich lässt sich der Lernstand in der App unter *Einstellungen → Exportieren* als JSON-Datei sichern.

---

## Lokal entwickeln

Voraussetzung: Node.js ≥ 20. Es gibt **keine** npm-Abhängigkeiten.

```sh
npm run dev        # http://localhost:8080, Daten in ./.data
npm test           # 219 automatische Tests (Inhalte + Server)
npm run seed       # Übungsdatenbank neu erzeugen (public/data/seed.sql)
```

### Aufbau

```
public/
  index.html           Einstieg
  css/app.css          Designsystem (Hell/Dunkel, responsiv, Druck)
  js/app.js            Router und Ansichten
  js/task.js           Aufgaben-Arbeitsplatz (alle 7 Typen)
  js/exam.js           Probeklausur und Benotung
  js/engine.js         SQL-Engine-Wrapper, Bewertung, deutsche Fehlermeldungen
  js/store.js          Lernstand, XP, Stufen, Abzeichen, Wiederholung, Sync
  js/content/*.js      Lerninhalte und Aufgaben (ein Modul je Datei)
  js/formelsammlung.js Formelsammlung (Klausur-Hilfsmittel)
  data/seed.sql        Übungsdatenbank Baustoffhandel
  data/buecherei.sql   Übungsdatenbank Stadtbücherei (Übungsblatt)
  vendor/              sql.js (SQLite/WASM, MIT-Lizenz)
  fonts/               IBM Plex Sans/Mono, Fraunces (OFL) – lokal, kein CDN
server/server.js       HTTP-Server ohne Abhängigkeiten + Lernstand-API
tests/                 node:test – prüft jede Musterlösung gegen die Engine
tools/gen-seed.mjs     Generator der Übungsdatenbank
docs/ISO25010.md       Qualitätsmodell und Nachweise
```

### Neue Aufgabe hinzufügen

In der passenden Datei unter `public/js/content/` ein Objekt in `tasks` ergänzen, z. B.:

```js
{ id: 's23', type: 'sql', level: 2,
  q: 'Welche Artikel kosten weniger als 5 €?',
  tables: ['artikel'],
  solution: 'SELECT bezeichnung FROM artikel WHERE vk_preis < 5;',
  hint: '…', explain: '…' }
```

`npm test` prüft automatisch, ob die Musterlösung läuft, ein nicht-leeres Ergebnis liefert und ihre eigene Bewertung besteht.

## Qualität

Die Anwendung ist entlang der Qualitätsmerkmale der **ISO/IEC 25010** entworfen – Details und Nachweise in [`docs/ISO25010.md`](docs/ISO25010.md).

## Lizenz

MIT. Enthaltene Drittkomponenten: sql.js (MIT), IBM Plex und Fraunces (SIL Open Font License).
