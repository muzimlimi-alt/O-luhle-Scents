import { motion as Motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const icons = {
  success: <CheckCircle className="elite-toast-icon text-emerald-500" />,
  error: <AlertCircle className="elite-toast-icon text-rose-500" />,
  warning: <AlertTriangle className="elite-toast-icon text-amber-500" />,
  info: <Info className="elite-toast-icon text-blue-500" />,
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
        gap: '16px',
        padding: '16px 20px',
        minWidth: '320px',
        maxWidth: '420px',
        background: 'rgba(15, 14, 13, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(var(--y-rgb), 0.2)',
        borderRadius: '4px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
        marginBottom: '12px',
        borderLeft: `4px solid ${
          type === 'success' ? '#10b981' : 
          type === 'error' ? '#ef4444' : 
          type === 'warning' ? '#f59e0b' : '#3b82f6'
        }`
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        {icons[type]}
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ 
          margin: 0, 
          color: '#fff', 
          fontSize: '0.95rem', 
          fontWeight: 600,
          fontFamily: 'Cormorant Garamond, serif'
        }}>
          {title}
        </h4>
        <p style={{ 
          margin: '4px 0 0', 
          color: 'rgba(255,255,255,0.6)', 
          fontSize: '0.8rem',
          lineHeight: 1.4
        }}>
          {message}
        </p>
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.color = '#fff'}
        onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.4)'}
      >
        <X size={18} />
      </button>
    </Motion.div>
  );
};

export default EliteToast;
