import { useCallback, useId, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useAppearance } from '../context/AppearanceContext';

const FINISH_OPTIONS = [
  { value: 'obsidian', label: 'Obsidian', hint: 'House default — near-black, gold on black.' },
  { value: 'ember', label: 'Ember', hint: 'Warm near-black, candlelit.' },
  { value: 'ivory', label: 'Ivory', hint: 'Light editorial, paper-and-ink.' },
];

const ACCENT_OPTIONS = [
  { value: 'gold', label: 'Gold', swatchClass: 'sw-gold' },
  { value: 'vetiver', label: 'Vetiver', swatchClass: 'sw-vetiver' },
  { value: 'cassis', label: 'Cassis', swatchClass: 'sw-cassis' },
  { value: 'cuivre', label: 'Cuivre', swatchClass: 'sw-cuivre' },
];

const PRESENCE_OPTIONS = [
  { value: 'editorial', label: 'Editorial', hint: 'House default — generous.' },
  { value: 'boutique', label: 'Boutique', hint: 'Gallery air, oversized figures.' },
  { value: 'operations', label: 'Operations', hint: 'Dense, mono figures, tight rows.' },
];

const LABELS = {
  finish: Object.fromEntries(FINISH_OPTIONS.map((o) => [o.value, o.label])),
  accent: Object.fromEntries(ACCENT_OPTIONS.map((o) => [o.value, o.label])),
  presence: Object.fromEntries(PRESENCE_OPTIONS.map((o) => [o.value, o.label])),
};

/**
 * Shared body for the Appearance system's two entry points — the profile
 * menu drawer (DashboardLayout) and the embedded section on the
 * Preferences page. All state lives in AppearanceProvider; this component
 * only renders radios and announces changes. Every change applies
 * instantly via setAppearance — there's no Save button.
 */
export function AppearancePanel() {
  const { appearance, setAppearance, resetAppearance } = useAppearance();
  const [announcement, setAnnouncement] = useState('');
  const groupId = useId();

  const announce = useCallback((message) => setAnnouncement(message), []);

  const pick = (axis, value) => {
    setAppearance({ [axis]: value });
    announce(`${LABELS[axis][value]} applied`);
  };

  const handleReset = () => {
    resetAppearance();
    announce('Appearance reset to the house default');
  };

  return (
    <div className="appearance-panel">
      <fieldset className="appearance-fieldset">
        <legend>Finish</legend>
        <div className="appearance-options appearance-options--stacked">
          {FINISH_OPTIONS.map((opt) => {
            const selected = appearance.finish === opt.value;
            return (
              <label key={opt.value} className={`appearance-option appearance-option--finish${selected ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name={`${groupId}-finish`}
                  value={opt.value}
                  checked={selected}
                  onChange={() => pick('finish', opt.value)}
                />
                <span className={`finish-swatch finish-swatch--${opt.value}`} aria-hidden="true">
                  <span className="finish-swatch__accent" />
                </span>
                <span className="appearance-option__body">
                  <span className="appearance-option__label">
                    {opt.label}
                    {selected && <Check size={14} className="appearance-option__check" aria-hidden="true" />}
                  </span>
                  <span className="appearance-option__hint">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="appearance-fieldset">
        <legend>House accent</legend>
        <div className="appearance-options appearance-options--accent">
          {ACCENT_OPTIONS.map((opt) => {
            const selected = appearance.accent === opt.value;
            return (
              <label key={opt.value} className={`appearance-option appearance-option--accent${selected ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name={`${groupId}-accent`}
                  value={opt.value}
                  checked={selected}
                  onChange={() => pick('accent', opt.value)}
                />
                <span className={`accent-dot ${opt.swatchClass}`} aria-hidden="true">
                  {selected && <Check size={12} />}
                </span>
                <span className="appearance-option__label appearance-option__label--accent">{opt.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="appearance-fieldset">
        <legend>Presence</legend>
        <div className="appearance-options appearance-options--stacked">
          {PRESENCE_OPTIONS.map((opt) => {
            const selected = appearance.presence === opt.value;
            return (
              <label key={opt.value} className={`appearance-option appearance-option--presence${selected ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name={`${groupId}-presence`}
                  value={opt.value}
                  checked={selected}
                  onChange={() => pick('presence', opt.value)}
                />
                <span className="appearance-option__body">
                  <span className="appearance-option__label">
                    {opt.label}
                    {selected && <Check size={14} className="appearance-option__check" aria-hidden="true" />}
                  </span>
                  <span className="appearance-option__hint">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button type="button" className="btn btn--outline appearance-reset" onClick={handleReset}>
        <RotateCcw size={16} /> Reset to house default
      </button>

      <p className="appearance-sr-only" role="status" aria-live="polite">{announcement}</p>

      <style dangerouslySetInnerHTML={{ __html: `
        .appearance-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .appearance-panel { display: flex; flex-direction: column; gap: 28px; }

        .appearance-fieldset { border: none; padding: 0; margin: 0; }
        .appearance-fieldset legend {
          font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--color-primary); padding: 0 0 12px;
        }

        .appearance-options { display: flex; flex-direction: column; gap: 10px; }
        .appearance-options--stacked { gap: 10px; }
        .appearance-options--accent { flex-direction: row; flex-wrap: wrap; gap: 14px; }

        .appearance-option {
          display: flex; align-items: center; gap: 14px;
          min-height: var(--tap, 44px);
          padding: 10px 14px;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          background: var(--color-bg-card);
        }
        .appearance-option:hover { border-color: var(--color-primary-light); }
        .appearance-option.is-selected { border-color: var(--color-primary); border-width: 2px; padding: 9px 13px; background: var(--y-muted); }
        .appearance-option input[type="radio"] {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
        .appearance-option:focus-within {
          outline: none; box-shadow: 0 0 0 3px var(--color-border-focus);
        }

        .appearance-option--accent {
          flex-direction: column; align-items: center; gap: 8px;
          min-width: 44px; padding: 12px 16px;
        }
        .appearance-option--accent.is-selected { padding: 11px 15px; }

        .appearance-option__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .appearance-option__label {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.9rem; font-weight: 600; color: var(--color-text-header);
        }
        .appearance-option__label--accent { font-size: 0.78rem; font-weight: 500; color: var(--color-text); }
        .appearance-option__check { color: var(--color-primary); flex-shrink: 0; }
        .appearance-option__hint { font-size: 0.75rem; color: var(--color-text-muted); }

        .finish-swatch {
          flex-shrink: 0; width: 44px; height: 32px; border-radius: 4px;
          border: 1px solid var(--color-border-light);
          display: flex; align-items: flex-end; justify-content: flex-end;
          padding: 4px; overflow: hidden;
        }
        .finish-swatch--obsidian { background: #0a0a0a; }
        .finish-swatch--obsidian .finish-swatch__accent { background: #1a1a1a; border: 1px solid #D4AF37; }
        .finish-swatch--ember { background: #110c08; }
        .finish-swatch--ember .finish-swatch__accent { background: #221a11; border: 1px solid #D4AF37; }
        .finish-swatch--ivory { background: #f2eee6; }
        .finish-swatch--ivory .finish-swatch__accent { background: #fffdf8; border: 1px solid #8A6A14; }
        .finish-swatch__accent { width: 14px; height: 14px; border-radius: 2px; }

        .accent-dot {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; border: 2px solid transparent;
        }
        .appearance-option--accent.is-selected .accent-dot { border-color: var(--color-text-header); }

        .appearance-reset { align-self: flex-start; }

        @media (max-width: 480px) {
          .appearance-options--accent { justify-content: space-between; }
        }
      `}} />
    </div>
  );
}

export default AppearancePanel;
