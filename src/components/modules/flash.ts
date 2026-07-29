/**
 * Scroll a module card into view and flash its outline — click feedback for
 * the sidebar (preset click, alert investigate). Cards carry id="module-<id>".
 */
export function flashCard(moduleId: string): void {
  const el = document.getElementById(`module-${moduleId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.animate(
    [
      { outline: '2px solid var(--accent-module)', outlineOffset: '2px' },
      { outline: '2px solid transparent', outlineOffset: '2px' },
    ],
    { duration: 1200 },
  );
}
