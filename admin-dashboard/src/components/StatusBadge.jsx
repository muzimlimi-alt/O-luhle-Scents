
const TONE_CLASS = {
  success: 'status-badge-ds--success',
  warning: 'status-badge-ds--warning',
  error: 'status-badge-ds--error',
  info: 'status-badge-ds--info',
  neutral: 'status-badge-ds--neutral',
};

/**
 * Standard status pill. Replaces .status-badge/.status-indicator/
 * .badge-status/.patron-status/.partner-status/.role-badge-elite/
 * .status-pill-elite — seven different ad hoc badge conventions that each
 * picked their own colors, several with real AA contrast failures.
 * Styled via global CSS (see App.css) rather than a per-instance injected
 * <style> tag, since a table can render dozens of these per page.
 */
export function StatusBadge({ tone = 'neutral', label, icon }) {
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.neutral;
  return (
    <span className={`status-badge-ds ${toneClass}`}>
      {icon && <span className="status-badge-ds__icon">{icon}</span>}
      {label}
    </span>
  );
}

export default StatusBadge;
