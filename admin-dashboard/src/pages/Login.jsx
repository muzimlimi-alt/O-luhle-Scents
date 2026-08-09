import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  AlertCircle, 
  Loader2,
  CheckCircle2
} from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid administrative credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="theme-dark">
      <div className="login-container-classic">
        {/* Background Decor */}
        <div className="login-dark-deco-radial"></div>
        <div className="login-dark-deco-line-top"></div>
        <div className="login-dark-deco-line-bottom"></div>

        <div className="login-card-classic">
          {/* Ornament */}
          <div className="login-ornament">
            <div className="ornament-line"></div>
            <div className="ornament-icon">
              <Lock size={16} />
            </div>
            <div className="ornament-line"></div>
          </div>

          <p className="brand-subtitle">TOCA</p>
          <h2 className="portal-title">Admin Portal</h2>
          <p className="portal-hint">Restricted access — authorised personnel only</p>

          <div className="portal-divider"></div>

          <form onSubmit={handleSubmit} className="login-form-classic">
            {error && (
              <div className="classic-alert alert--danger animate-shake">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="classic-alert alert--success">
                <CheckCircle2 size={14} />
                <span>Identity Verified. Entering Portal...</span>
              </div>
            )}

            <div className="classic-form-group">
              <label className="classic-label">Email Address</label>
              <input 
                type="email" 
                className="classic-input" 
                placeholder="admin@toca.co.za"
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
              />
            </div>

            <div className="classic-form-group">
              <label className="classic-label">Password</label>
              <input 
                type="password" 
                className="classic-input" 
                placeholder="••••••••" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || success}
              />
            </div>

            <div className="classic-form-options">
              <label className="classic-checkbox-container">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="classic-checkmark"></span>
                Remember My Scent
              </label>
              <a href="#" className="classic-forgot-link">Forgot?</a>
            </div>

            <button 
              type="submit" 
              className={`btn btn--primary classic-login-btn ${loading ? 'loading' : ''}`}
              disabled={loading || success}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <span>Enter</span>}
            </button>
          </form>

          <p className="portal-footer-mark">✦ PRIVATE DASHBOARD ✦</p>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .login-container-classic {
            min-height: 100vh;
            background: var(--color-bg-dark);
            display: flex;
            align-items: center; justify-content: center;
            position: relative; overflow: hidden;
            padding: 20px;
          }

          .login-dark-deco-radial {
            position: absolute; inset: 0; pointer-events: none;
            background: radial-gradient(ellipse 60% 50% at 20% 50%, rgba(184, 155, 106, 0.07) 0%, transparent 70%),
                        radial-gradient(ellipse 40% 60% at 80% 30%, rgba(184, 155, 106, 0.05) 0%, transparent 60%);
          }
          .login-dark-deco-line-top {
            position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
            opacity: 0.4;
          }
          .login-dark-deco-line-bottom {
            position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(184, 155, 106, 0.3), transparent);
          }

          .login-card-classic {
            width: 100%; max-width: 440px;
            background: var(--glass-bg);
            backdrop-filter: blur(2px);
            border: 1px solid rgba(184, 155, 106, 0.2);
            box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(184, 155, 106, 0.1);
            padding: 56px 52px;
            text-align: center;
            border-radius: 2px;
            position: relative; z-index: 10;
          }

          .login-ornament {
            display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 28px;
          }
          .ornament-line {
            height: 1px; width: 32px;
            background: linear-gradient(to right, transparent, var(--color-primary));
          }
          .login-ornament .ornament-line:last-child {
            background: linear-gradient(to left, transparent, var(--color-primary));
          }
          .ornament-icon {
            width: 44px; height: 44px;
            border: 1px solid rgba(184, 155, 106, 0.5);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: var(--color-primary);
          }

          .brand-subtitle {
            font-size: 0.6rem; letter-spacing: 0.22em; text-transform: uppercase;
            color: var(--color-primary); margin-bottom: 10px; font-weight: 500;
          }
          .portal-title {
            font-family: var(--font-display);
            font-size: 2.4rem; font-weight: 300; margin-bottom: 6px; letter-spacing: 0.02em;
            color: var(--color-text-header);
          }
          .portal-hint {
            font-size: 0.75rem; margin-bottom: 40px; letter-spacing: 0.04em;
            color: rgba(245, 240, 232, 0.4);
          }
          .portal-divider {
            height: 1px; background: linear-gradient(to right, transparent, rgba(184, 155, 106, 0.25), transparent);
            margin-bottom: 36px;
          }

          .classic-form-group { text-align: left; margin-bottom: 24px; }
          .classic-label {
            display: block; font-size: 0.62rem; font-weight: 500; letter-spacing: 0.14em;
            text-transform: uppercase; color: var(--color-primary); opacity: 0.85; margin-bottom: 10px;
          }
          .classic-input {
            width: 100%; height: 48px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(184, 155, 106, 0.2);
            padding: 12px 16px;
            border-radius: 2px;
            color: var(--color-text-header);
            font-size: 0.88rem;
            transition: all 0.3s;
            outline: none;
          }
          .classic-input:focus {
            border-color: rgba(184, 155, 106, 0.75);
            background: rgba(184, 155, 106, 0.06);
          }

          .classic-form-options {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 0.75rem; margin-bottom: 36px;
          }
          .classic-checkbox-container { display: flex; align-items: center; gap: 8px; cursor: pointer; color: rgba(245, 240, 232, 0.6); position: relative; }
          .classic-checkbox-container input { position: absolute; opacity: 0; width: 16px; height: 16px; margin: 0; cursor: pointer; }
          .classic-checkmark {
            flex-shrink: 0; width: 16px; height: 16px; border-radius: 2px;
            background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(184, 155, 106, 0.35);
            transition: all 0.2s; position: relative;
          }
          .classic-checkbox-container:hover .classic-checkmark { border-color: var(--color-primary); }
          .classic-checkbox-container input:checked ~ .classic-checkmark { background: var(--color-primary); border-color: var(--color-primary); }
          .classic-checkmark::after {
            content: ''; position: absolute; display: none;
            left: 5px; top: 1px; width: 4px; height: 8px;
            border: solid var(--color-bg-dark); border-width: 0 2px 2px 0; transform: rotate(45deg);
          }
          .classic-checkbox-container input:checked ~ .classic-checkmark::after { display: block; }
          .classic-checkbox-container input:focus-visible ~ .classic-checkmark { outline: none; box-shadow: 0 0 0 3px var(--color-border-focus); }
          .classic-forgot-link { color: var(--color-primary); text-decoration: none; font-weight: 500; }

          .classic-login-btn {
            width: 100%; height: 52px;
            text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.75rem;
            font-weight: 600; border-radius: 2px;
          }

          .portal-footer-mark {
            margin-top: 32px; font-size: 0.62rem; letter-spacing: 0.1em;
            color: rgba(245, 240, 232, 0.2);
          }

          .classic-alert {
            margin-bottom: 16px; padding: 10px 14px;
            display: flex; align-items: center; gap: 10px;
            font-size: 0.8rem; border-radius: 2px; text-align: left;
          }
          .alert--danger { background: rgba(192, 57, 43, 0.12); border: 1px solid rgba(192, 57, 43, 0.3); color: var(--color-error-text); }
          .alert--success { background: rgba(39, 174, 96, 0.12); border: 1px solid rgba(39, 174, 96, 0.3); color: var(--color-success-text); }
        `}} />
      </div>
    </div>
  );
}

export default Login;
