// Chart.js reads plain color strings, not CSS custom properties — so any
// chart has to resolve the current Appearance tokens itself rather than
// referencing var(--y-base) directly in its options object. Call this once
// per render; pair it with a `key` on the chart component (see Dashboard.jsx)
// that changes when Appearance changes, so Chart.js actually remounts
// instead of caching the old colors on its canvas.
export function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

  return {
    accent: read('--y-base', '#D4AF37'),
    accentMuted: `rgba(${read('--y-rgb', '212, 175, 55')}, 0.1)`,
    grid: `rgba(${read('--y-rgb', '212, 175, 55')}, 0.15)`,
    text: read('--text-secondary', '#b0b0b0'),
    textMuted: read('--text-muted', '#8f8f8f'),
    heading: read('--text-primary', '#ffffff'),
  };
}
