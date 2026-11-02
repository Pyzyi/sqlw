// SQL-Formelsammlung – entspricht inhaltlich dem Hilfsmittel, das in der Klausur erlaubt ist.
import { h, md, icon, modal } from './ui.js';
import { highlight } from './editor.js';

export const FORMELSAMMLUNG = [
  { t: 'Aufbau einer Abfrage', rows: [
    ['SELECT [DISTINCT] Spalten\nFROM Tabelle\n[WHERE Bedingung]\n[GROUP BY Spalten]\n[HAVING Bedingung]\n[ORDER BY Spalten [ASC|DESC]]\n[LIMIT Anzahl]', 'Reihenfolge der Klauseln. Ausgewertet wird in der Reihenfolge FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT.'],
    ['SELECT *\nSELECT Spalte1, Spalte2', 'Alle Spalten bzw. nur die genannten Spalten ausgeben.'],
    ['SELECT DISTINCT Spalte', 'Doppelte Zeilen im Ergebnis entfernen.'],
    ['Ausdruck AS Name\nFROM Tabelle t', 'Alias: Spalte oder Berechnung umbenennen, z. B. `Preis * 3 AS Dreitagespreis`. Tabelle abkürzen, dann Spalten mit `t.Spalte` ansprechen.'],
    ['ORDER BY Spalte [ASC|DESC]', 'Sortieren. ASC aufsteigend (Standard), DESC absteigend.'],
    ['LIMIT Anzahl', 'Nur die ersten Zeilen des Ergebnisses ausgeben.'],
  ] },
  { t: 'Bedingungen und Operatoren (WHERE)', rows: [
    ['=  <>  <  <=  >  >=', 'Vergleiche (gleich, ungleich, kleiner, kleiner gleich, größer, größer gleich).'],
    ['AND  OR  NOT', 'Bedingungen logisch verknüpfen. AND bindet stärker als OR, Klammern setzen.'],
    ['BETWEEN Wert1 AND Wert2', 'Wert liegt im Bereich, Grenzen eingeschlossen.'],
    ['IN (Wert1, Wert2, ...)', 'Wert kommt in der Liste vor. NOT IN: kommt nicht vor.'],
    ["LIKE 'Muster'", 'Textvergleich mit Platzhaltern. `%` steht für beliebig viele Zeichen, `_` für genau ein Zeichen.'],
    ['IS NULL  IS NOT NULL', 'Prüfen, ob ein Wert unbekannt ist. Nicht mit `= NULL` prüfen.'],
    ['+  -  *  /', 'Rechnen in SELECT und WHERE.'],
  ] },
  { t: 'Aggregatfunktionen und Gruppierung', rows: [
    ['COUNT(*)', 'Anzahl aller Datensätze.'],
    ['COUNT(Spalte)\nCOUNT(DISTINCT Spalte)', 'Anzahl der Datensätze mit Wert (nicht NULL) bzw. der verschiedenen Werte.'],
    ['SUM(Spalte | Ausdruck)', 'Summe der Werte.'],
    ['AVG(Spalte | Ausdruck)', 'Durchschnitt der Werte.'],
    ['MIN(Spalte)  MAX(Spalte)', 'Kleinster bzw. größter Wert.'],
    ['GROUP BY Spalte1 [, Spalte2]', 'Datensätze zu Gruppen zusammenfassen. Im SELECT stehen dann nur Gruppierungsspalten und Aggregatfunktionen.'],
    ['HAVING Bedingung', 'Gruppen filtern, meist mit einer Aggregatfunktion. WHERE filtert einzelne Datensätze vorher, HAVING filtert Gruppen nachher.'],
  ] },
  { t: 'Mehrere Tabellen', rows: [
    ['FROM A JOIN B\nON A.Schlüssel = B.Schlüssel', 'Verknüpft zwei Tabellen. Es erscheinen nur Zeilen, deren Schlüsselwerte übereinstimmen (INNER JOIN). Weitere Tabellen mit je einem weiteren JOIN … ON … anhängen.'],
    ['WHERE Spalte > (SELECT ...)', 'Unterabfrage mit Vergleich. Die Unterabfrage darf dann nur einen Wert liefern.'],
    ['WHERE Spalte IN (SELECT ...)', 'Unterabfrage mit Liste. Die Unterabfrage liefert eine Spalte mit mehreren Werten.'],
  ] },
  { t: 'Daten ändern', rows: [
    ['INSERT INTO Tabelle\n(Spalte1, Spalte2)\nVALUES (Wert1, Wert2)', 'Neuen Datensatz einfügen. Texte stehen in einfachen Anführungszeichen, Zahlen ohne.'],
    ['UPDATE Tabelle\nSET Spalte = Wert\n[WHERE Bedingung]', 'Werte ändern. Rechts darf der alte Wert verwendet werden, z. B. `SET Preis = Preis + 2`.'],
    ['DELETE FROM Tabelle\n[WHERE Bedingung]', 'Datensätze löschen. Achtung: Ohne WHERE wirken UPDATE und DELETE auf alle Datensätze.'],
  ] },
];

export function formelsammlungView() {
  return h('div', { class: 'formel' }, FORMELSAMMLUNG.map((sec) => h('section', null,
    h('h3', null, sec.t),
    h('div', { class: 'table-scroll' }, h('table', { class: 'ref-table formel-table' },
      h('thead', null, h('tr', null, h('th', null, 'Syntax'), h('th', null, 'Beschreibung'))),
      h('tbody', null, sec.rows.map(([syn, desc]) => {
        const pre = h('pre');
        pre.innerHTML = highlight(syn).trimEnd();
        return h('tr', null, h('td', null, pre), h('td', { html: md(desc) }));
      })))))));
}

export function openFormelsammlung() {
  modal((close) => h('div', null,
    h('div', { class: 'row', style: { marginBottom: '10px' } }, h('div', null, h('p', { class: 'eyebrow accent' }, 'In der Klausur erlaubt'), h('h2', { class: 'h2' }, 'Formelsammlung')), h('span', { class: 'spacer' }), h('button', { class: 'btn ghost sm', type: 'button', onclick: close }, icon('x'), 'Schließen')),
    h('p', { class: 'small muted' }, 'Eckige Klammern [ ] bedeuten: optional.'),
    formelsammlungView()), { wide: true });
}

export const formelsammlungButton = () => h('button', { class: 'btn ghost sm', type: 'button', onclick: openFormelsammlung, title: 'Formelsammlung öffnen (in der Klausur erlaubt)' }, icon('sheet'), 'Formelsammlung');
