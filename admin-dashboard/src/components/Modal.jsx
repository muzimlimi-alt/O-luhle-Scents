import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-content" 
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3 className="modal-title font-title">{title}</h3>
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            {children}
          </div>
        </motion.div>

        <style dangerouslySetInnerHTML={{ __html: `
          .modal-overlay { 
            position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); 
            z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
          }
          .modal-content { 
            background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg);
            width: 100%; max-width: 600px; box-shadow: var(--shadow-md); max-height: 90vh; overflow-y: auto;
          }
          .modal-header { 
            padding: 24px; border-bottom: 1px solid var(--color-border); 
            display: flex; justify-content: space-between; align-items: center; 
          }
          .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--color-primary); }
          .modal-close { 
            background: none; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; 
          }
          .modal-close:hover { color: var(--color-error-text); }
          .modal-body { padding: 24px; }
        `}} />
      </div>
    </AnimatePresence>
  );
}
