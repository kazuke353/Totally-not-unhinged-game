import { buildOutback } from './outback.js';
import { buildComplex } from './complex.js';
import { buildSilo } from './silo.js';

export const MAPS = {
  outback: { name: 'Outback Perimeter', build: buildOutback },
  complex: { name: 'Security Complex', build: buildComplex },
  silo: { name: 'Silo 7', build: buildSilo },
};
