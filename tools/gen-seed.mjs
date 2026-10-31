// Erzeugt public/data/seed.sql deterministisch (gleiche Daten bei jedem Lauf).
// Aufruf: node tools/gen-seed.mjs
import { writeFileSync } from 'node:fs';

let s = 20260131;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const q = (v) => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const ins = (t, cols, rows) => `INSERT INTO ${t} (${cols.join(', ')}) VALUES\n` + rows.map(r => '  (' + r.map(q).join(', ') + ')').join(',\n') + ';\n';

const out = [];
out.push(`-- Lerndatenbank "Baustoffhandel Hansen GmbH" (fiktiv)
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
`);

out.push(ins('filiale', ['filiale_id', 'name', 'ort'], [
  [1, 'Kassel-Mitte', 'Kassel'], [2, 'Hamburg-Nord', 'Hamburg'], [3, 'Würzburg', 'Würzburg'], [4, 'Köln-Deutz', 'Köln']]));

const ma = [
  [1, 'Jana', 'Krüger', 'Filialleitung', 4850, '2015-04-01', 1],
  [2, 'Tobias', 'Wendt', 'Verkauf', 3420, '2018-09-15', 1],
  [3, 'Aylin', 'Demir', 'Verkauf', 3380, '2020-02-01', 2],
  [4, 'Marco', 'Lehmann', 'Filialleitung', 4720, '2012-07-01', 2],
  [5, 'Sophie', 'Brandt', 'Lager', 2950, '2021-05-10', 3],
  [6, 'Lukas', 'Hoffmann', 'Verkauf', 3510, '2017-03-20', 3],
  [7, 'Nina', 'Schulte', 'Filialleitung', 4900, '2014-01-15', 4],
  [8, 'Erik', 'Vogel', 'Verkauf', 3290, '2022-08-01', 4],
  [9, 'Paul', 'Seidel', 'Auszubildender', 1150, '2025-08-01', null],
  [10, 'Mara', 'Jung', 'Buchhaltung', 3980, '2016-11-01', 1]];
out.push(ins('mitarbeiter', ['mitarbeiter_id', 'vorname', 'nachname', 'position', 'gehalt', 'eintritt', 'filiale_id'], ma));

const kunden = [
  [1, 'Bauunternehmen Weber GmbH', 'Kassel', '34117', 'Gewerbe', 8, 'info@weber-bau.example'],
  [2, 'Dachdeckerei Lang', 'Baunatal', '34225', 'Gewerbe', 5, 'kontakt@dach-lang.example'],
  [3, 'Familie Schröder', 'Kassel', '34119', 'Privat', 0, null],
  [4, 'Hanse Hochbau AG', 'Hamburg', '20095', 'Gewerbe', 10, 'einkauf@hanse-hochbau.example'],
  [5, 'Malerbetrieb Yilmaz', 'Hamburg', '22041', 'Gewerbe', 4, 'yilmaz@maler-hh.example'],
  [6, 'Thomas Becker', 'Norderstedt', '22846', 'Privat', 0, 't.becker@web.example'],
  [7, 'Main-Bau Würzburg GmbH', 'Würzburg', '97070', 'Gewerbe', 7, 'bestellung@mainbau.example'],
  [8, 'Holzbau Franken', 'Ochsenfurt', '97199', 'Gewerbe', 6, 'info@holzbau-franken.example'],
  [9, 'Lisa Kaiser', 'Würzburg', '97072', 'Privat', 2, null],
  [10, 'Rheinland Sanierung KG', 'Köln', '50667', 'Gewerbe', 9, 'office@rs-koeln.example'],
  [11, 'Fliesen Özdemir', 'Köln', '51103', 'Gewerbe', 3, 'oezdemir@fliesen-koeln.example'],
  [12, 'Jonas Wolf', 'Bergisch Gladbach', '51465', 'Privat', 0, 'jwolf@gmx.example'],
  [13, 'Sanitär Petersen', 'Hamburg', '20253', 'Gewerbe', 5, null],
  [14, 'Garten & Landschaft Roth', 'Kassel', '34131', 'Gewerbe', 4, 'roth@gala-roth.example']];
out.push(ins('kunde', ['kunde_id', 'firma', 'ort', 'plz', 'kundentyp', 'rabatt', 'email'], kunden));

out.push(ins('kategorie', ['kategorie_id', 'bezeichnung'], [
  [1, 'Mauerwerk'], [2, 'Dämmung'], [3, 'Holz'], [4, 'Werkzeug'], [5, 'Sanitär'], [6, 'Farben & Lacke'], [7, 'Garten']]));

const art = [
  [1, 'Kalksandstein KS 20 DF', 1, 'Stück', 1.10, 1.79, 4800],
  [2, 'Porenbetonstein 365 mm', 1, 'Stück', 3.20, 4.95, 1250],
  [3, 'Mauermörtel MM 10 (25 kg)', 1, 'Sack', 3.40, 5.49, 620],
  [4, 'Klinker rot-bunt', 1, 'Stück', 0.62, 1.09, 9000],
  [5, 'Mineralwolle WLG 035 100 mm', 2, 'm²', 4.10, 6.89, 840],
  [6, 'EPS-Dämmplatte 120 mm', 2, 'm²', 5.30, 8.49, 410],
  [7, 'Holzfaserplatte 60 mm', 2, 'm²', 11.80, 17.90, 160],
  [8, 'KVH Fichte 60x120 (5 m)', 3, 'Stück', 14.50, 22.90, 300],
  [9, 'OSB-Platte 18 mm', 3, 'Stück', 17.20, 26.50, 220],
  [10, 'Dachlatte 30x50 (4 m)', 3, 'Stück', 2.10, 3.49, 1500],
  [11, 'Terrassendiele Lärche (4 m)', 3, 'Stück', 18.90, 29.90, 0],
  [12, 'Akku-Bohrschrauber 18 V', 4, 'Stück', 89.00, 149.00, 24],
  [13, 'Wasserwaage 120 cm', 4, 'Stück', 21.50, 39.90, 35],
  [14, 'Maurerkelle', 4, 'Stück', 6.20, 12.90, 80],
  [15, 'Winkelschleifer 125 mm', 4, 'Stück', 54.00, 94.90, 12],
  [16, 'HT-Rohr DN 110 (2 m)', 5, 'Stück', 7.40, 12.49, 150],
  [17, 'Waschtisch Keramik 60 cm', 5, 'Stück', 49.00, 89.00, 18],
  [18, 'Spülkasten Unterputz', 5, 'Stück', 98.00, 169.00, 9],
  [19, 'Dispersionsfarbe weiß 12,5 l', 6, 'Eimer', 24.00, 42.90, 75],
  [20, 'Tiefengrund 10 l', 6, 'Kanister', 13.50, 23.90, 60],
  [21, 'Holzlasur Teak 2,5 l', 6, 'Dose', 16.00, 28.50, 40],
  [22, 'Fassadenfarbe 15 l', 6, 'Eimer', 49.00, 84.00, 0]];
out.push(ins('artikel', ['artikel_id', 'bezeichnung', 'kategorie_id', 'einheit', 'ek_preis', 'vk_preis', 'bestand'], art));

// Bestellungen: Kunden 1-12 (13 und 14 bestellen nie), Artikel 22 wird nie bestellt
const vertrieb = { Kassel: [2, 1], Baunatal: [2, 1], Hamburg: [3, 4], Norderstedt: [3], 'Würzburg': [6, 5], Ochsenfurt: [6], 'Köln': [8, 7], 'Bergisch Gladbach': [8] };
const kundenOrder = [1, 4, 7, 10, 2, 5, 8, 11, 3, 6, 9, 12, 1, 4, 7, 10, 1, 4, 2, 5, 8, 11, 7, 10, 4, 1, 3, 9, 6, 12, 10, 4];
const bestell = [], pos = [];
let day = new Date(Date.UTC(2026, 0, 5));
kundenOrder.forEach((kid, i) => {
  const k = kunden[kid - 1];
  const mid = pick(vertrieb[k[2]]);
  day = new Date(day.getTime() + int(5, 10) * 864e5);
  if (day.getUTCDay() === 0) day = new Date(day.getTime() + 864e5);
  if (day.getUTCDay() === 6) day = new Date(day.getTime() + 2 * 864e5);
  const iso = day.toISOString().slice(0, 10);
  let status = i >= 28 ? 'offen' : 'geliefert';
  if (i === 9 || i === 21) status = 'storniert';
  const id = 1001 + i;
  bestell.push([id, kid, mid, iso, status]);
  const n = k[4] === 'Privat' ? int(1, 2) : int(2, 4);
  const used = new Set();
  for (let j = 0; j < n; j++) {
    let a; do { a = int(1, 21); } while (used.has(a)); used.add(a);
    const e = art[a - 1][3];
    const menge = e === 'Stück' && art[a - 1][5] < 5 ? int(10, 60) * 10 : e === 'm²' ? int(4, 30) * 5 : e === 'Sack' ? int(5, 40) : int(1, 8);
    pos.push([id, a, menge]);
  }
});
out.push(ins('bestellung', ['bestell_id', 'kunde_id', 'mitarbeiter_id', 'bestelldatum', 'status'], bestell));
pos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
out.push(ins('bestellposition', ['bestell_id', 'artikel_id', 'menge'], pos));

// Buchungen: normale Buchungen + gezielte Auffälligkeiten
const buch = [];
const texte = { '8400': 'Erlöse Warenverkauf', '3400': 'Wareneingang Lieferant', '4930': 'Bürobedarf', '4650': 'Bewirtung Kunden', '1000': 'Kasseneinlage' };
let bd = new Date(Date.UTC(2026, 0, 2));
let beleg = 4100;
for (let i = 0; i < 30; i++) {
  bd = new Date(bd.getTime() + int(4, 9) * 864e5);
  while (bd.getUTCDay() === 0 || bd.getUTCDay() === 6) bd = new Date(bd.getTime() + 864e5);
  const konto = pick(['8400', '8400', '8400', '3400', '3400', '4930', '4650', '1000']);
  const betrag = konto === '8400' ? int(300, 6800) + int(0, 99) / 100 : konto === '3400' ? int(800, 7400) + int(0, 99) / 100 : konto === '4930' ? int(15, 240) + int(0, 99) / 100 : konto === '4650' ? int(40, 320) + int(0, 99) / 100 : int(100, 900);
  buch.push([bd.toISOString().slice(0, 10), 'B-' + (beleg++), konto, betrag, texte[konto], pick([2, 3, 6, 8, 10, 10])]);
}
// Auffälligkeiten
buch.push(['2026-03-17', 'B-4205', '3400', 4380.50, 'Wareneingang Lieferant', 10]);
buch.push(['2026-03-17', 'B-4205', '3400', 4380.50, 'Wareneingang Lieferant', 10]); // doppelte Buchung
buch.push(['2026-04-11', 'B-4210', '8400', 1250.00, 'Erlöse Warenverkauf', 3]);    // Samstag
buch.push(['2026-05-24', 'B-4219', '4650', 5000.00, 'Bewirtung Kunden', 4]);        // Sonntag + runder, hoher Betrag
buch.push(['2026-06-08', 'B-4224', '3400', 9999.00, 'Wareneingang Lieferant', 2]);  // knapp unter Freigabegrenze 10.000
buch.push(['2026-06-09', 'B-4225', '3400', 9990.00, 'Wareneingang Lieferant', 2]);  // knapp unter Freigabegrenze
buch.push(['2026-07-02', null, '4930', 780.00, 'Bürobedarf', 8]);                   // fehlender Beleg
buch.push(['2026-07-15', 'B-4231', '8400', -2400.00, 'Erlöse Warenverkauf', 6]);    // negativer Erlös ohne Gutschrift
buch.push(['2026-08-03', 'B-4236', '3400', 25000.00, 'Wareneingang Lieferant', 9]); // Azubi bucht 25.000
buch.push(['2027-02-01', 'B-4240', '8400', 3100.00, 'Erlöse Warenverkauf', 3]);     // Datum in der Zukunft
buch.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
out.push(ins('buchung', ['buchung_id', 'datum', 'beleg_nr', 'konto', 'betrag', 'buchungstext', 'mitarbeiter_id'], buch.map((b, i) => [i + 1, ...b])));

out.push(ins('kunden_import', ['import_id', 'name', 'ort', 'plz', 'email', 'telefon', 'kundentyp', 'erfasst_am'], [
  [1, 'Bauunternehmen Weber GmbH', 'Kassel', '34117', 'info@weber-bau.example', '0561 01003456', 'Gewerbe', '2026-03-02'],
  [2, ' Weber Bauunternehmen GmbH ', 'kassel', '34117', 'info@weber-bau.example', '0561/01003456', 'gewerbe', '02.03.2026'],
  [3, 'Müller Baustoffe', 'KÖLN', '5067', 'mueller@baustoffe', null, 'G', '2026-04-11'],
  [4, 'Mueller Baustoffe', 'Köln', '50670', 'mueller@baustoffe.example', '0221 01004455', 'Gewerbe', '2026-04-11'],
  [5, 'Anna Richter', 'Hamburg', '20095', null, '040 01008877', 'Privat', '2026-05-20'],
  [6, 'Anna Richter', 'Hamburg', '20095', null, '040 01008877', 'Privat', '2026-05-20'],
  [7, 'Dachbau Nord', 'Hamburg ', '22041', 'info@dachbau-nord.example', '+49 40 01004433', 'GEWERBE', '2026-06-01'],
  [8, 'Peter Klein', 'Würzburg', '97070', 'p.klein@@mail.example', '0931-01002233', 'privat', '2026-13-05'],
  [9, 'Holz & Mehr', 'wuerzburg', '97072', 'info@holzundmehr.example', '', 'Gewerbe', '05/06/2026'],
  [10, null, 'Köln', '51103', 'kontakt@fliesenprofi.example', '0221 01007788', 'Gewerbe', '2026-07-14'],
  [11, 'Sabine Hartmann', 'Kassel', '341190', 's.hartmann@t-online.example', '0561 01005566', 'Privat', '2026-07-30'],
  [12, 'Malerei Becker', 'Norderstedt', '22846', 'becker.malerei@web.example', '040 01003344', 'Gewerbe', '2026-08-03']]));

writeFileSync(new URL('../public/data/seed.sql', import.meta.url), out.join('\n'));
console.log(`seed.sql: ${bestell.length} Bestellungen, ${pos.length} Positionen, ${buch.length} Buchungen`);
