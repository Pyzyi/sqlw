import qualitaet from './m1-qualitaet.js';
import bereinigung from './m2-bereinigung.js';
import projekt from './m3-projekt.js';
import select from './m4-select.js';
import aggregat from './m5-aggregat.js';
import joins from './m6-joins.js';
import dml from './m7-dml.js';
import uebungsblatt from './m8-uebungsblatt.js';

export const MODULES = [qualitaet, bereinigung, projekt, select, aggregat, joins, dml, uebungsblatt];

// Syntax, die nicht in der Formelsammlung steht → „Vertiefung“, nicht Teil der Probeklausur
const BEYOND = /\bLEFT\s+JOIN\b|\bUNION\b|\bCASE\b|\bTRIM\s*\(|\bREPLACE\s*\(|\bSUBSTR\s*\(|\bLENGTH\s*\(|\bstrftime\s*\(|\bCOALESCE\s*\(|\bROUND\s*\(|\|\|/i;
export const isZusatz = (t) => !!t.zusatz || BEYOND.test(`${t.solution || ''} ${t.sql || ''} ${t.type === 'mc' || t.type === 'predict' ? t.q : ''}`);

export const XP_BY_LEVEL = { 1: 10, 2: 20, 3: 30 };

// Flache Liste aller Aufgaben mit Modulbezug
export const ALL_TASKS = MODULES.flatMap((m) => m.tasks.map((t) => ({ ...t, module: m.id, key: `${m.id}/${t.id}`, zusatz: isZusatz(t) })));
export const TASK_BY_KEY = Object.fromEntries(ALL_TASKS.map((t) => [t.key, t]));
export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));
