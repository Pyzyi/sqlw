-- Lerndatenbank "Baustoffhandel Hansen GmbH" (fiktiv)
PRAGMA foreign_keys = ON;

CREATE TABLE filiale (
  filiale_id   INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  ort          TEXT NOT NULL
);

CREATE TABLE mitarbeiter (
  mitarbeiter_id INTEGER PRIMARY KEY,
  vorname        TEXT NOT NULL,
  nachname       TEXT NOT NULL,
  position       TEXT NOT NULL,
  gehalt         REAL NOT NULL,
  eintritt       DATE NOT NULL,
  filiale_id     INTEGER REFERENCES filiale(filiale_id)
);

CREATE TABLE kunde (
  kunde_id   INTEGER PRIMARY KEY,
  firma      TEXT NOT NULL,
  ort        TEXT NOT NULL,
  plz        TEXT NOT NULL,
  kundentyp  TEXT NOT NULL CHECK (kundentyp IN ('Gewerbe','Privat')),
  rabatt     REAL NOT NULL DEFAULT 0,
  email      TEXT
);

CREATE TABLE kategorie (
  kategorie_id INTEGER PRIMARY KEY,
  bezeichnung  TEXT NOT NULL
);

CREATE TABLE artikel (
  artikel_id   INTEGER PRIMARY KEY,
  bezeichnung  TEXT NOT NULL,
  kategorie_id INTEGER NOT NULL REFERENCES kategorie(kategorie_id),
  einheit      TEXT NOT NULL,
  ek_preis     REAL NOT NULL,
  vk_preis     REAL NOT NULL,
  bestand      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bestellung (
  bestell_id     INTEGER PRIMARY KEY,
  kunde_id       INTEGER NOT NULL REFERENCES kunde(kunde_id),
  mitarbeiter_id INTEGER NOT NULL REFERENCES mitarbeiter(mitarbeiter_id),
  bestelldatum   DATE NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('offen','geliefert','storniert'))
);

CREATE TABLE bestellposition (
  bestell_id INTEGER NOT NULL REFERENCES bestellung(bestell_id),
  artikel_id INTEGER NOT NULL REFERENCES artikel(artikel_id),
  menge      INTEGER NOT NULL,
  PRIMARY KEY (bestell_id, artikel_id)
);

CREATE TABLE buchung (
  buchung_id     INTEGER PRIMARY KEY,
  datum          DATE NOT NULL,
  beleg_nr       TEXT,
  konto          TEXT NOT NULL,
  betrag         REAL NOT NULL,
  buchungstext   TEXT,
  mitarbeiter_id INTEGER REFERENCES mitarbeiter(mitarbeiter_id)
);

-- Absichtlich "schmutzige" Importtabelle zum Bereinigen
CREATE TABLE kunden_import (
  import_id  INTEGER PRIMARY KEY,
  name       TEXT,
  ort        TEXT,
  plz        TEXT,
  email      TEXT,
  telefon    TEXT,
  kundentyp  TEXT,
  erfasst_am TEXT
);

INSERT INTO filiale (filiale_id, name, ort) VALUES
  (1, 'Kassel-Mitte', 'Kassel'),
  (2, 'Hamburg-Nord', 'Hamburg'),
  (3, 'Würzburg', 'Würzburg'),
  (4, 'Köln-Deutz', 'Köln');

INSERT INTO mitarbeiter (mitarbeiter_id, vorname, nachname, position, gehalt, eintritt, filiale_id) VALUES
  (1, 'Jana', 'Krüger', 'Filialleitung', 4850, '2015-04-01', 1),
  (2, 'Tobias', 'Wendt', 'Verkauf', 3420, '2018-09-15', 1),
  (3, 'Aylin', 'Demir', 'Verkauf', 3380, '2020-02-01', 2),
  (4, 'Marco', 'Lehmann', 'Filialleitung', 4720, '2012-07-01', 2),
  (5, 'Sophie', 'Brandt', 'Lager', 2950, '2021-05-10', 3),
  (6, 'Lukas', 'Hoffmann', 'Verkauf', 3510, '2017-03-20', 3),
  (7, 'Nina', 'Schulte', 'Filialleitung', 4900, '2014-01-15', 4),
  (8, 'Erik', 'Vogel', 'Verkauf', 3290, '2022-08-01', 4),
  (9, 'Paul', 'Seidel', 'Auszubildender', 1150, '2025-08-01', NULL),
  (10, 'Mara', 'Jung', 'Buchhaltung', 3980, '2016-11-01', 1);

INSERT INTO kunde (kunde_id, firma, ort, plz, kundentyp, rabatt, email) VALUES
  (1, 'Bauunternehmen Weber GmbH', 'Kassel', '34117', 'Gewerbe', 8, 'info@weber-bau.example'),
  (2, 'Dachdeckerei Lang', 'Baunatal', '34225', 'Gewerbe', 5, 'kontakt@dach-lang.example'),
  (3, 'Familie Schröder', 'Kassel', '34119', 'Privat', 0, NULL),
  (4, 'Hanse Hochbau AG', 'Hamburg', '20095', 'Gewerbe', 10, 'einkauf@hanse-hochbau.example'),
  (5, 'Malerbetrieb Yilmaz', 'Hamburg', '22041', 'Gewerbe', 4, 'yilmaz@maler-hh.example'),
  (6, 'Thomas Becker', 'Norderstedt', '22846', 'Privat', 0, 't.becker@web.example'),
  (7, 'Main-Bau Würzburg GmbH', 'Würzburg', '97070', 'Gewerbe', 7, 'bestellung@mainbau.example'),
  (8, 'Holzbau Franken', 'Ochsenfurt', '97199', 'Gewerbe', 6, 'info@holzbau-franken.example'),
  (9, 'Lisa Kaiser', 'Würzburg', '97072', 'Privat', 2, NULL),
  (10, 'Rheinland Sanierung KG', 'Köln', '50667', 'Gewerbe', 9, 'office@rs-koeln.example'),
  (11, 'Fliesen Özdemir', 'Köln', '51103', 'Gewerbe', 3, 'oezdemir@fliesen-koeln.example'),
  (12, 'Jonas Wolf', 'Bergisch Gladbach', '51465', 'Privat', 0, 'jwolf@gmx.example'),
  (13, 'Sanitär Petersen', 'Hamburg', '20253', 'Gewerbe', 5, NULL),
  (14, 'Garten & Landschaft Roth', 'Kassel', '34131', 'Gewerbe', 4, 'roth@gala-roth.example');

INSERT INTO kategorie (kategorie_id, bezeichnung) VALUES
  (1, 'Mauerwerk'),
  (2, 'Dämmung'),
  (3, 'Holz'),
  (4, 'Werkzeug'),
  (5, 'Sanitär'),
  (6, 'Farben & Lacke'),
  (7, 'Garten');

INSERT INTO artikel (artikel_id, bezeichnung, kategorie_id, einheit, ek_preis, vk_preis, bestand) VALUES
  (1, 'Kalksandstein KS 20 DF', 1, 'Stück', 1.1, 1.79, 4800),
  (2, 'Porenbetonstein 365 mm', 1, 'Stück', 3.2, 4.95, 1250),
  (3, 'Mauermörtel MM 10 (25 kg)', 1, 'Sack', 3.4, 5.49, 620),
  (4, 'Klinker rot-bunt', 1, 'Stück', 0.62, 1.09, 9000),
  (5, 'Mineralwolle WLG 035 100 mm', 2, 'm²', 4.1, 6.89, 840),
  (6, 'EPS-Dämmplatte 120 mm', 2, 'm²', 5.3, 8.49, 410),
  (7, 'Holzfaserplatte 60 mm', 2, 'm²', 11.8, 17.9, 160),
  (8, 'KVH Fichte 60x120 (5 m)', 3, 'Stück', 14.5, 22.9, 300),
  (9, 'OSB-Platte 18 mm', 3, 'Stück', 17.2, 26.5, 220),
  (10, 'Dachlatte 30x50 (4 m)', 3, 'Stück', 2.1, 3.49, 1500),
  (11, 'Terrassendiele Lärche (4 m)', 3, 'Stück', 18.9, 29.9, 0),
  (12, 'Akku-Bohrschrauber 18 V', 4, 'Stück', 89, 149, 24),
  (13, 'Wasserwaage 120 cm', 4, 'Stück', 21.5, 39.9, 35),
  (14, 'Maurerkelle', 4, 'Stück', 6.2, 12.9, 80),
  (15, 'Winkelschleifer 125 mm', 4, 'Stück', 54, 94.9, 12),
  (16, 'HT-Rohr DN 110 (2 m)', 5, 'Stück', 7.4, 12.49, 150),
  (17, 'Waschtisch Keramik 60 cm', 5, 'Stück', 49, 89, 18),
  (18, 'Spülkasten Unterputz', 5, 'Stück', 98, 169, 9),
  (19, 'Dispersionsfarbe weiß 12,5 l', 6, 'Eimer', 24, 42.9, 75),
  (20, 'Tiefengrund 10 l', 6, 'Kanister', 13.5, 23.9, 60),
  (21, 'Holzlasur Teak 2,5 l', 6, 'Dose', 16, 28.5, 40),
  (22, 'Fassadenfarbe 15 l', 6, 'Eimer', 49, 84, 0);

INSERT INTO bestellung (bestell_id, kunde_id, mitarbeiter_id, bestelldatum, status) VALUES
  (1001, 1, 2, '2026-01-12', 'geliefert'),
  (1002, 4, 4, '2026-01-19', 'geliefert'),
  (1003, 7, 5, '2026-01-29', 'geliefert'),
  (1004, 10, 7, '2026-02-05', 'geliefert'),
  (1005, 2, 2, '2026-02-12', 'geliefert'),
  (1006, 5, 4, '2026-02-17', 'geliefert'),
  (1007, 8, 6, '2026-02-23', 'geliefert'),
  (1008, 11, 7, '2026-03-02', 'geliefert'),
  (1009, 3, 2, '2026-03-11', 'geliefert'),
  (1010, 6, 3, '2026-03-18', 'storniert'),
  (1011, 9, 5, '2026-03-27', 'geliefert'),
  (1012, 12, 8, '2026-04-01', 'geliefert'),
  (1013, 1, 2, '2026-04-06', 'geliefert'),
  (1014, 4, 3, '2026-04-16', 'geliefert'),
  (1015, 7, 6, '2026-04-22', 'geliefert'),
  (1016, 10, 8, '2026-05-01', 'geliefert'),
  (1017, 1, 2, '2026-05-06', 'geliefert'),
  (1018, 4, 3, '2026-05-12', 'geliefert'),
  (1019, 2, 1, '2026-05-19', 'geliefert'),
  (1020, 5, 4, '2026-05-29', 'geliefert'),
  (1021, 8, 6, '2026-06-03', 'geliefert'),
  (1022, 11, 8, '2026-06-10', 'storniert'),
  (1023, 7, 6, '2026-06-18', 'geliefert'),
  (1024, 10, 8, '2026-06-23', 'geliefert'),
  (1025, 4, 3, '2026-07-02', 'geliefert'),
  (1026, 1, 2, '2026-07-13', 'geliefert'),
  (1027, 3, 1, '2026-07-21', 'geliefert'),
  (1028, 9, 6, '2026-07-27', 'geliefert'),
  (1029, 6, 3, '2026-08-03', 'offen'),
  (1030, 12, 8, '2026-08-10', 'offen'),
  (1031, 10, 8, '2026-08-17', 'offen'),
  (1032, 4, 3, '2026-08-25', 'offen');

INSERT INTO bestellposition (bestell_id, artikel_id, menge) VALUES
  (1001, 1, 500),
  (1001, 5, 95),
  (1001, 8, 8),
  (1001, 19, 8),
  (1002, 1, 260),
  (1002, 15, 7),
  (1002, 17, 3),
  (1003, 4, 200),
  (1003, 20, 3),
  (1004, 9, 6),
  (1004, 15, 2),
  (1004, 17, 3),
  (1005, 9, 2),
  (1005, 14, 8),
  (1005, 15, 7),
  (1005, 16, 4),
  (1006, 10, 570),
  (1006, 13, 5),
  (1006, 19, 7),
  (1007, 9, 3),
  (1007, 10, 540),
  (1007, 18, 2),
  (1008, 6, 35),
  (1008, 14, 1),
  (1008, 20, 1),
  (1009, 3, 27),
  (1009, 13, 3),
  (1010, 8, 8),
  (1010, 13, 4),
  (1011, 3, 7),
  (1012, 20, 3),
  (1013, 13, 7),
  (1013, 21, 1),
  (1014, 7, 130),
  (1014, 21, 3),
  (1015, 2, 170),
  (1015, 3, 38),
  (1015, 11, 4),
  (1015, 18, 5),
  (1016, 2, 470),
  (1016, 19, 6),
  (1017, 1, 190),
  (1017, 14, 5),
  (1017, 17, 4),
  (1018, 14, 3),
  (1018, 18, 1),
  (1018, 21, 1),
  (1019, 13, 7),
  (1019, 17, 3),
  (1019, 21, 2),
  (1020, 1, 410),
  (1020, 5, 110),
  (1020, 15, 7),
  (1021, 2, 580),
  (1021, 5, 120),
  (1021, 13, 1),
  (1022, 3, 39),
  (1022, 4, 190),
  (1022, 6, 75),
  (1022, 14, 1),
  (1023, 3, 20),
  (1023, 6, 105),
  (1023, 12, 8),
  (1024, 1, 110),
  (1024, 21, 1),
  (1025, 2, 380),
  (1025, 3, 36),
  (1025, 16, 6),
  (1026, 1, 340),
  (1026, 11, 2),
  (1026, 14, 1),
  (1027, 13, 3),
  (1028, 13, 6),
  (1029, 1, 360),
  (1030, 12, 6),
  (1031, 3, 7),
  (1031, 4, 570),
  (1031, 10, 330),
  (1032, 5, 35),
  (1032, 16, 2),
  (1032, 18, 1);

INSERT INTO buchung (buchung_id, datum, beleg_nr, konto, betrag, buchungstext, mitarbeiter_id) VALUES
  (1, '2026-01-07', 'B-4100', '3400', 3945.7, 'Wareneingang Lieferant', 8),
  (2, '2026-01-15', 'B-4101', '8400', 5704.41, 'Erlöse Warenverkauf', 10),
  (3, '2026-01-19', 'B-4102', '8400', 6000.99, 'Erlöse Warenverkauf', 6),
  (4, '2026-01-26', 'B-4103', '8400', 6768.69, 'Erlöse Warenverkauf', 3),
  (5, '2026-02-03', 'B-4104', '4650', 74.41, 'Bewirtung Kunden', 6),
  (6, '2026-02-09', 'B-4105', '4930', 207.2, 'Bürobedarf', 3),
  (7, '2026-02-16', 'B-4106', '1000', 762, 'Kasseneinlage', 2),
  (8, '2026-02-20', 'B-4107', '8400', 5360.97, 'Erlöse Warenverkauf', 10),
  (9, '2026-03-02', 'B-4108', '8400', 4116.84, 'Erlöse Warenverkauf', 6),
  (10, '2026-03-09', 'B-4109', '8400', 387.91, 'Erlöse Warenverkauf', 6),
  (11, '2026-03-13', 'B-4110', '8400', 4543.43, 'Erlöse Warenverkauf', 3),
  (12, '2026-03-17', 'B-4111', '8400', 5573.08, 'Erlöse Warenverkauf', 10),
  (13, '2026-03-17', 'B-4205', '3400', 4380.5, 'Wareneingang Lieferant', 10),
  (14, '2026-03-17', 'B-4205', '3400', 4380.5, 'Wareneingang Lieferant', 10),
  (15, '2026-03-23', 'B-4112', '1000', 768, 'Kasseneinlage', 3),
  (16, '2026-03-30', 'B-4113', '8400', 849.29, 'Erlöse Warenverkauf', 10),
  (17, '2026-04-06', 'B-4114', '8400', 4165.07, 'Erlöse Warenverkauf', 8),
  (18, '2026-04-11', 'B-4210', '8400', 1250, 'Erlöse Warenverkauf', 3),
  (19, '2026-04-15', 'B-4115', '8400', 2076.35, 'Erlöse Warenverkauf', 6),
  (20, '2026-04-24', 'B-4116', '3400', 4831.71, 'Wareneingang Lieferant', 3),
  (21, '2026-04-30', 'B-4117', '3400', 1547.54, 'Wareneingang Lieferant', 2),
  (22, '2026-05-11', 'B-4118', '8400', 4854.43, 'Erlöse Warenverkauf', 6),
  (23, '2026-05-19', 'B-4119', '3400', 950, 'Wareneingang Lieferant', 10),
  (24, '2026-05-24', 'B-4219', '4650', 5000, 'Bewirtung Kunden', 4),
  (25, '2026-05-25', 'B-4120', '8400', 4803.12, 'Erlöse Warenverkauf', 10),
  (26, '2026-06-01', 'B-4121', '4650', 111.83, 'Bewirtung Kunden', 3),
  (27, '2026-06-08', 'B-4224', '3400', 9999, 'Wareneingang Lieferant', 2),
  (28, '2026-06-09', 'B-4122', '3400', 2739.14, 'Wareneingang Lieferant', 6),
  (29, '2026-06-09', 'B-4225', '3400', 9990, 'Wareneingang Lieferant', 2),
  (30, '2026-06-15', 'B-4123', '3400', 1110.7, 'Wareneingang Lieferant', 2),
  (31, '2026-06-24', 'B-4124', '3400', 4138.01, 'Wareneingang Lieferant', 3),
  (32, '2026-07-02', 'B-4125', '8400', 1693.13, 'Erlöse Warenverkauf', 8),
  (33, '2026-07-02', NULL, '4930', 780, 'Bürobedarf', 8),
  (34, '2026-07-10', 'B-4126', '8400', 3066.73, 'Erlöse Warenverkauf', 8),
  (35, '2026-07-15', 'B-4231', '8400', -2400, 'Erlöse Warenverkauf', 6),
  (36, '2026-07-16', 'B-4127', '3400', 2284.28, 'Wareneingang Lieferant', 3),
  (37, '2026-07-21', 'B-4128', '8400', 978.42, 'Erlöse Warenverkauf', 8),
  (38, '2026-07-29', 'B-4129', '3400', 4940.18, 'Wareneingang Lieferant', 6),
  (39, '2026-08-03', 'B-4236', '3400', 25000, 'Wareneingang Lieferant', 9),
  (40, '2027-02-01', 'B-4240', '8400', 3100, 'Erlöse Warenverkauf', 3);

INSERT INTO kunden_import (import_id, name, ort, plz, email, telefon, kundentyp, erfasst_am) VALUES
  (1, 'Bauunternehmen Weber GmbH', 'Kassel', '34117', 'info@weber-bau.example', '0561 01003456', 'Gewerbe', '2026-03-02'),
  (2, ' Weber Bauunternehmen GmbH ', 'kassel', '34117', 'info@weber-bau.example', '0561/01003456', 'gewerbe', '02.03.2026'),
  (3, 'Müller Baustoffe', 'KÖLN', '5067', 'mueller@baustoffe', NULL, 'G', '2026-04-11'),
  (4, 'Mueller Baustoffe', 'Köln', '50670', 'mueller@baustoffe.example', '0221 01004455', 'Gewerbe', '2026-04-11'),
  (5, 'Anna Richter', 'Hamburg', '20095', NULL, '040 01008877', 'Privat', '2026-05-20'),
  (6, 'Anna Richter', 'Hamburg', '20095', NULL, '040 01008877', 'Privat', '2026-05-20'),
  (7, 'Dachbau Nord', 'Hamburg ', '22041', 'info@dachbau-nord.example', '+49 40 01004433', 'GEWERBE', '2026-06-01'),
  (8, 'Peter Klein', 'Würzburg', '97070', 'p.klein@@mail.example', '0931-01002233', 'privat', '2026-13-05'),
  (9, 'Holz & Mehr', 'wuerzburg', '97072', 'info@holzundmehr.example', '', 'Gewerbe', '05/06/2026'),
  (10, NULL, 'Köln', '51103', 'kontakt@fliesenprofi.example', '0221 01007788', 'Gewerbe', '2026-07-14'),
  (11, 'Sabine Hartmann', 'Kassel', '341190', 's.hartmann@t-online.example', '0561 01005566', 'Privat', '2026-07-30'),
  (12, 'Malerei Becker', 'Norderstedt', '22846', 'becker.malerei@web.example', '040 01003344', 'Gewerbe', '2026-08-03');
