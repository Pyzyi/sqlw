import qualitaet from './m1-qualitaet.js';
import bereinigung from './m2-bereinigung.js';
import projekt from './m3-projekt.js';
import select from './m4-select.js';
import aggregat from './m5-aggregat.js';
import joins from './m6-joins.js';
import dml from './m7-dml.js';

export const MODULES = [qualitaet, bereinigung, projekt, select, aggregat, joins, dml];

export const XP_BY_LEVEL = { 1: 10, 2: 20, 3: 30 };

// Flache Liste aller Aufgaben mit Modulbezug
export const ALL_TASKS = MODULES.flatMap((m) => m.tasks.map((t) => ({ ...t, module: m.id, key: `${m.id}/${t.id}` })));
export const TASK_BY_KEY = Object.fromEntries(ALL_TASKS.map((t) => [t.key, t]));
export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));
