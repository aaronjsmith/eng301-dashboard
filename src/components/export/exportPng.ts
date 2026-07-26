import { toPng } from 'html-to-image';
import type { Role } from '../../types';

/**
 * FR7 "Current view" — client-side PNG capture of the dashboard exactly as
 * displayed (sizes, filters, baselines, theme). The stamp bar is appended
 * for the capture only, then removed.
 */
export async function exportCurrentView(
  el: HTMLElement,
  stamp: string,
  role: Role,
): Promise<void> {
  const stampBar = document.createElement('div');
  stampBar.textContent = stamp;
  stampBar.setAttribute(
    'style',
    [
      'padding: 10px 16px',
      'font-size: 11px',
      'color: var(--text-secondary)',
      'background: var(--bg-surface)',
      'border-top: 1px solid var(--border)',
    ].join(';'),
  );
  el.appendChild(stampBar);

  try {
    const styles = getComputedStyle(document.documentElement);
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: styles.getPropertyValue('--bg-app').trim() || '#eef1f6',
      filter: (node) =>
        !(node instanceof HTMLElement && node.dataset.exportExclude === 'true'),
    });
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `dashboard_${role}_${date}.png`;
    link.href = dataUrl;
    link.click();
  } finally {
    stampBar.remove();
  }
}
