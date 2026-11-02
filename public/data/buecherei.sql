-- Lerndatenbank "Stadtbücherei" (Übungsblatt Teil B, fiktiv)
-- Primärschlüssel ist jeweils die erste Spalte.
PRAGMA foreign_keys = ON;

CREATE TABLE Verlag (
  VerlagNr INTEGER PRIMARY KEY,
  Name     TEXT NOT NULL,
  Ort      TEXT NOT NULL
);

CREATE TABLE Buch (
  BuchNr           INTEGER PRIMARY KEY,
  Titel            TEXT NOT NULL,
  Genre            TEXT NOT NULL,
  Seiten           INTEGER NOT NULL,
  Erscheinungsjahr INTEGER,
  VerlagNr         INTEGER NOT NULL REFERENCES Verlag(VerlagNr)
);

CREATE TABLE Mitglied (
  MitgliedNr INTEGER PRIMARY KEY,
  Nachname   TEXT NOT NULL,
  Vorname    TEXT NOT NULL,
  Ort        TEXT NOT NULL
);

CREATE TABLE Entleihe (
  EntleiheNr INTEGER PRIMARY KEY,
  MitgliedNr INTEGER NOT NULL REFERENCES Mitglied(MitgliedNr),
  BuchNr     INTEGER NOT NULL REFERENCES Buch(BuchNr),
  Datum      DATE NOT NULL,
  Tage       INTEGER NOT NULL
);

INSERT INTO Verlag (VerlagNr, Name, Ort) VALUES
  (1, 'Nordlicht Verlag', 'Hamburg'),
  (2, 'Sonnenberg Verlag', 'München'),
  (3, 'Rhein & Main Verlag', 'Köln');

INSERT INTO Buch (BuchNr, Titel, Genre, Seiten, Erscheinungsjahr, VerlagNr) VALUES
  (1, 'Das Schweigen der Elbe', 'Krimi', 320, 2018, 1),
  (2, 'Nachtzug nach Wien', 'Krimi', 288, 2021, 2),
  (3, 'Kochen mit Kräutern', 'Ratgeber', 150, 2019, 3),
  (4, 'Sterne über Norwegen', 'Roman', 410, 2015, 1),
  (5, 'Python für Einsteiger', 'Ratgeber', 260, 2022, 2),
  (6, 'Der letzte Sommer', 'Roman', 352, NULL, 3),
  (7, 'Mord am See', 'Krimi', 301, 2023, 1);

INSERT INTO Mitglied (MitgliedNr, Nachname, Vorname, Ort) VALUES
  (1, 'Lorenz', 'Lukas', 'Lindau'),
  (2, 'Yildiz', 'Selin', 'Talheim'),
  (3, 'Wagner', 'Hanna', 'Lindau'),
  (4, 'Frisch', 'Tom', 'Seedorf');

INSERT INTO Entleihe (EntleiheNr, MitgliedNr, BuchNr, Datum, Tage) VALUES
  (1, 1, 2, '2026-09-01', 14),
  (2, 1, 7, '2026-09-03', 21),
  (3, 2, 2, '2026-09-05', 14),
  (4, 3, 5, '2026-09-08', 28),
  (5, 3, 1, '2026-09-12', 14),
  (6, 1, 5, '2026-09-15', 21),
  (7, 2, 7, '2026-09-20', 14),
  (8, 3, 2, '2026-09-22', 7);
