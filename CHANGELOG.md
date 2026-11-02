# Changelog

## v2.0.1 – Fehlerbehebung

### Behoben
- Aufgaben, die schon gelöst waren und in einer Probeklausur erneut richtig beantwortet wurden, landeten fälschlich in der Wiederholung und senkten die Klausurreife.
- Die Auswertung einer fehlerfreien Probeklausur meldete trotzdem „Falsch beantwortete Aufgaben sind in deiner Wiederholung“.
- Neue Tests für die Lernstand-Logik (XP, Wiederholung).

## v2.0.0 – Übungsblatt & Formelsammlung

### Neu
- **Modul 08 „Übungsblatt“**: das komplette Wiederholungsblatt aus dem Unterricht als interaktive Übung
  - Teil A (Aufgaben 1–4, Fitnessstudio): Freitextfragen mit Musterantwort und Erwartungshorizont
  - Teil B (Aufgaben 5–10, Stadtbücherei): alle SQL-Aufgaben auf einer eigenen Bücherei-Datenbank
  - Aufgabe 11 als „Zusatz IHK – nicht Klausurstoff“ gekennzeichnet
- **Neuer Aufgabentyp Freitext**: Antwort schreiben, mit Musterantwort vergleichen, Erwartungshorizont abhaken
- **Neuer Aufgabentyp Ergebnistabelle**: das Ergebnis einer Abfrage selbst in eine Tabelle eintragen
- **Formelsammlung** als eigene Seite und in jeder SQL-Aufgabe und der Probeklausur aufrufbar – wie in der echten Klausur
- **Probeklausur „Übungsblatt-Klausur“** (90 Minuten, Teil A + B) mit Selbstkontrolle der Freitextantworten vor der Benotung
- **Zweite Lerndatenbank** (Stadtbücherei), in der Spielwiese umschaltbar

### Geändert
- Datenqualität: Ausrichtung auf die **vier Kernkriterien** aus dem Unterricht (Vollständigkeit, Korrektheit, Konsistenz, Aktualität) mit Prüffragen
- Aufgaben, die Syntax außerhalb der Formelsammlung verwenden (LEFT JOIN, UNION, CASE, TRIM, …), werden automatisch als **„Vertiefung“** markiert und erscheinen nicht mehr in der Probeklausur
- Fehler-finden-Aufgaben können jetzt verlangen, dass eine bestimmte Technik verwendet wird (z. B. Unterabfrage, IN, MAX)

### Umfang
- 199 Aufgaben in 8 Modulen, 219 automatisierte Tests

## v1.0.0
- Erste Version: 7 Module, Lerneinheiten, Probeklausuren, Wiederholung, Gamification, Docker/ZimaOS
