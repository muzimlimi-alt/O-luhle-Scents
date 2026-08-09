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
            background: var(--bg-page);
            display: flex;
            align-items: center; justify-content: center;
            position: relative; overflow: hidden;
            padding: var(--sp-5);
          }

          .login-dark-deco-radial {
            position: absolute; inset: 0; pointer-events: none;
            background: radial-gradient(ellipse 60% 50% at 20% 50%, rgba(var(--y-rgb), 0.07) 0%, transparent 70%),
                        radial-gradient(ellipse 40% 60% at 80% 30%, rgba(var(--y-rgb), 0.05) 0%, transparent 60%);
          }
          .login-dark-deco-line-top {
            position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, var(--y-base), transparent);
            opacity: 0.4;
          }
          .login-dark-deco-line-bottom {
            position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(var(--y-rgb), 0.3), transparent);
          }

          .login-card-classic {
            width: 100%; max-width: 440px;
            background: var(--bg-glass);
            backdrop-filter: blur(2px);
            border: 1px solid rgba(var(--y-rgb), 0.2);
            box-shadow: var(--sh-xl), inset 0 1px 0 rgba(var(--y-rgb), 0.1);
            padding: var(--sp-7, 48px) var(--sp-6);
            text-align: center;
            border-radius: var(--r);
            position: relative; z-index: 10;
          }

          .login-ornament {
            display: flex; align-items: center; justify-content: center; gap: var(--sp-3); margin-bottom: var(--sp-6);
          }
          .ornament-line {
            height: 1px; width: 32px;
            background: linear-gradient(to right, transparent, var(--y-base));
          }
          .login-ornament .ornament-line:last-child {
            background: linear-gradient(to left, transparent, var(--y-base));
          }
          .ornament-icon {
            width: 44px; height: 44px;
            border: 1px solid rgba(var(--y-rgb), 0.5);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: var(--y-base);
          }

          .brand-subtitle {
            font-size: .6rem; letter-spacing: .22em; text-transform: uppercase;
            color: var(--y-base); margin-bottom: var(--sp-2); font-weight: 500;
          }
          .portal-title {
            font-family: var(--f-display);
            font-size: 2.4rem; font-weight: 400; margin-bottom: 6px; letter-spacing: .02em;
            color: var(--text-primary);
          }
          .portal-hint {
            font-size: .75rem; margin-bottom: var(--sp-7, 48px); letter-spacing: .04em;
            color: var(--text-muted);
          }
          .portal-divider {
            height: 1px; background: linear-gradient(to right, transparent, rgba(var(--y-rgb), 0.25), transparent);
            margin-bottom: var(--sp-6);
          }

          .classic-form-group { text-align: left; margin-bottom: var(--sp-5); }
          .classic-label {
            display: block; font-size: .68rem; font-weight: 400; letter-spacing: .16em;
            text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--sp-2);
          }
          .classic-input {
            width: 100%; height: var(--tap);
            background: var(--bg-elevated);
            border: 1px solid var(--border-default);
            padding: 0 var(--sp-4);
            border-radius: var(--r);
            color: var(--text-primary);
            font-family: var(--f-body);
            font-weight: 300;
            font-size: .88rem;
            transition: all var(--t-fast, .18s) var(--ease, ease);
            outline: none;
          }
          .classic-input:focus {
            border-color: var(--y-base);
          }

          .classic-form-options {
            display: flex; justify-content: space-between; align-items: center;
            font-size: .75rem; margin-bottom: var(--sp-6);
          }
          .classic-checkbox-container { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; color: var(--text-muted); position: relative; }
          .classic-checkbox-container input { position: absolute; opacity: 0; width: 16px; height: 16px; margin: 0; cursor: pointer; }
          .classic-checkmark {
            flex-shrink: 0; width: 16px; height: 16px; border-radius: var(--r);
            background: var(--bg-elevated); border: 1px solid var(--border-strong);
            transition: all 0.2s; position: relative;
          }
          .classic-checkbox-container:hover .classic-checkmark { border-color: var(--y-base); }
          .classic-checkbox-container input:checked ~ .classic-checkmark { background: var(--y-base); border-color: var(--y-base); }
          .classic-checkmark::after {
            content: ''; position: absolute; display: none;
            left: 5px; top: 1px; width: 4px; height: 8px;
            border: solid var(--bg-page); border-width: 0 2px 2px 0; transform: rotate(45deg);
          }
          .classic-checkbox-container input:checked ~ .classic-checkmark::after { display: block; }
          .classic-checkbox-container input:focus-visible ~ .classic-checkmark { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }
          .classic-forgot-link { color: var(--y-base); text-decoration: none; font-weight: 500; }

          .classic-login-btn {
            width: 100%; height: var(--tap);
            text-transform: uppercase; letter-spacing: .2em; font-size: .75rem;
            font-weight: 500; border-radius: var(--r);
          }

          .portal-footer-mark {
            margin-top: var(--sp-6); font-size: .62rem; letter-spacing: .1em;
            color: var(--text-muted); opacity: .6;
          }

          .classic-alert {
            margin-bottom: var(--sp-4); padding: var(--sp-3) var(--sp-4);
            display: flex; align-items: center; gap: var(--sp-3);
            font-size: .8rem; border-radius: var(--r); text-align: left;
          }
          .alert--danger { background: rgba(var(--bad-rgb), 0.09); border: 1px solid rgba(var(--bad-rgb), 0.4); color: var(--error); }
          .alert--success { background: rgba(var(--ok-rgb), 0.09); border: 1px solid rgba(var(--ok-rgb), 0.4); color: var(--success); }

          @media (max-width: 480px) {
            .login-card-classic { padding: var(--sp-6) var(--sp-4); }
            .portal-title { font-size: 1.9rem; }
          }
        `}} />
      </div>
    </div>
  );
}

export default Login;
