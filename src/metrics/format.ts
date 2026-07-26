/**
 * Display formatting — the ONE place numbers become strings, so every panel
 * shows the spec's exact forms ("86.0%", "+9.0", "−12.2").
 */

const MINUS = '−'; // U+2212, typographic minus

export function percent1(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function score1(value: number): string {
  return value.toFixed(1);
}

export function signedPoints(value: number): string {
  const abs = Math.abs(value).toFixed(1);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `${MINUS}${abs}`;
  return '0.0';
}

export function points1(value: number): string {
  return `${value.toFixed(1)} pts`;
}

export function countFmt(value: number): string {
  return String(Math.round(value));
}

export function formatUnit(
  value: number,
  unit: 'percent' | 'points' | 'count' | 'score',
): string {
  switch (unit) {
    case 'percent':
      return percent1(value);
    case 'points':
      return signedPoints(value);
    case 'count':
      return countFmt(value);
    case 'score':
      return score1(value);
  }
}
