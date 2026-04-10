import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button 
      onClick={toggleTheme}
      className={`theme-toggle-btn ${theme}`}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle Theme"
    >
      <div className="icon-wrapper">
        {theme === 'dark' ? (
          <Sun size={18} className="theme-icon sun" />
        ) : (
          <Moon size={18} className="theme-icon moon" />
        )}
      </div>
      <span className="toggle-text">{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>

      <style dangerouslySetInnerHTML={{ __html: `
        .theme-toggle-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          padding: 6px 14px;
          border-radius: 4px;
          cursor: pointer;
          transition: var(--transition);
          color: var(--color-text-header);
        }

        .theme-toggle-btn:hover {
          border-color: var(--color-primary);
          background: rgba(184, 155, 106, 0.05);
          transform: translateY(-1px);
        }

        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
        }

        .toggle-text {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--color-text-muted);
        }

        .theme-icon {
          animation: rotateIn 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }

        @keyframes rotateIn {
          from { transform: rotate(-90deg) scale(0); opacity: 0; }
          to { transform: rotate(0) scale(1); opacity: 1; }
        }
      `}} />
    </button>
  );
}
