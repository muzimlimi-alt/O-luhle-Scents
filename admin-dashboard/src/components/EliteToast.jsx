import { motion as Motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const ICON_COLOR = {
  success: 'var(--atl-sage, var(--success))',
  error:   'var(--atl-clay, var(--error))',
  warning: 'var(--atl-orange, var(--warning))',
  info:    'var(--atl-blue, var(--info))',
};

const icons = {
  success: <CheckCircle className="elite-toast-icon" style={{ color: ICON_COLOR.success }} />,
  error:   <AlertCircle className="elite-toast-icon" style={{ color: ICON_COLOR.error }} />,
  warning: <AlertTriangle className="elite-toast-icon" style={{ color: ICON_COLOR.warning }} />,
  info:    <Info className="elite-toast-icon" style={{ color: ICON_COLOR.info }} />,
};

const EliteToast = ({ type = 'success', title, message, onClose }) => {
  return (
    <Motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`elite-toast elite-toast--${type} glass-panel`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-4) var(--sp-5)',
        minWidth: '320px',
        maxWidth: '420px',
        background: 'var(--bg-glass, rgba(20,20,20,.92))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--sh-xl)',
        pointerEvents: 'auto',
        marginBottom: 'var(--sp-3)',
        borderLeft: `4px solid ${ICON_COLOR[type] || ICON_COLOR.info}`,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        {icons[type]}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{
          margin: 0,
          color: 'var(--text-primary)',
          fontSize: 'var(--fs-base)',
          fontWeight: 400,
          fontFamily: 'var(--f-display)',
        }}>
          {title}
        </h4>
        <p style={{
          margin: 'var(--sp-1) 0 0',
          color: 'var(--text-secondary)',
          fontSize: 'var(--fs-sm)',
          lineHeight: 1.5,
        }}>
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'color var(--t-fast) ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <X size={18} />
      </button>
    </Motion.div>
  );
};

export default EliteToast;
