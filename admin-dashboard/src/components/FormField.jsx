import React, { useId } from 'react';

/**
 * Wraps a single form control (input/select/textarea) with a properly
 * associated <label>, a required-field indicator, and hint/error slots wired
 * up via aria-describedby/aria-invalid. Fixes the codebase-wide gap where
 * every label was only visually adjacent to its input with no htmlFor/id
 * pairing, and there was no shared inline-validation pattern.
 *
 * The wrapped child automatically gets the shared `.form-input` visual
 * style merged in, replacing the ~6 different hand-rolled input classes
 * (.elite-glass-input, .settings-input, .input-field, etc.).
 */
export function FormField({ label, required = false, error, hint, children }) {
  const generatedId = useId();
  const child = React.Children.only(children);
  const inputId = child.props.id || generatedId;
  const describedBy = [
    error ? `${inputId}-error` : null,
    hint ? `${inputId}-hint` : null,
  ].filter(Boolean).join(' ') || undefined;

  const enhancedChild = React.cloneElement(child, {
    id: inputId,
    className: [child.props.className, 'form-input'].filter(Boolean).join(' '),
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : undefined,
    'aria-required': required ? 'true' : undefined,
  });

  return (
    <div className="form-field">
      {label && (
        <label htmlFor={inputId} className="form-field__label">
          {label}
          {required && <span className="form-field__required" aria-hidden="true"> *</span>}
        </label>
      )}
      {enhancedChild}
      {hint && !error && <p id={`${inputId}-hint`} className="form-field__hint">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="form-field__error" role="alert">{error}</p>}
    </div>
  );
}

export default FormField;
