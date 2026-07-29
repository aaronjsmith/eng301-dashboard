/** Collision-safe id for module instances (crypto when available). */
export function freshId(base: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
}
