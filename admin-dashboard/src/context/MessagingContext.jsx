import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessagingContext } from './MessagingContext';
import EliteToast from '../components/EliteToast';

export const MessagingProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showMessage = useCallback((type, title, message) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, type, title, message }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const removeMessage = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Listen for global events (from api.js interceptors)
  React.useEffect(() => {
    const handleGlobalMessage = (e) => {
      const { type, title, message } = e.detail;
      showMessage(type, title, message);
    };

    window.addEventListener('admin_message', handleGlobalMessage);
    return () => window.removeEventListener('admin_message', handleGlobalMessage);
  }, [showMessage]);

  return (
    <MessagingContext.Provider value={{ showMessage }}>
      {children}
      <div className="elite-toast-stack" style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none'
      }}>
        <AnimatePresence>
          {notifications.map((n) => (
            <EliteToast 
              key={n.id} 
              {...n} 
              onClose={() => removeMessage(n.id)} 
            />
          ))}
        </AnimatePresence>
      </div>
    </MessagingContext.Provider>
  );
};
