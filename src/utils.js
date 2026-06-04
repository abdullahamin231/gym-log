export function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeExerciseName(name) {
  return String(name || '').trim().toLowerCase();
}

export function ensureTargetRepsLength(targetReps, sets) {
  const next = Array.isArray(targetReps) ? targetReps.slice(0, sets) : [];
  const last = next.length ? next[next.length - 1] : 0;
  while (next.length < sets) next.push(last);
  return next;
}

export function parseTargetReps(value, sets) {
  const numbers = String(value || '')
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(n => !Number.isNaN(n));
  if (!numbers.length) return Array(sets).fill(0);
  const target = [];
  for (let i = 0; i < sets; i++) {
    target[i] = numbers[i] ?? numbers[numbers.length - 1];
  }
  return target;
}

export function formatTarget(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '\u2014';
  return String(n);
}

export function formatTargetReps(targetReps) {
  const arr = Array.isArray(targetReps) ? targetReps : [];
  const pieces = arr.map(formatTarget);
  if (!pieces.length || pieces.every(p => p === '\u2014')) return '\u2014';
  if (pieces.every(p => p === pieces[0])) return pieces[0];
  return pieces.join('/');
}
