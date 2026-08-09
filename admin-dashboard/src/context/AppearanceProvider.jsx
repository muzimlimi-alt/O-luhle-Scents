import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { AppearanceContext, APPEARANCE_CLASS } from './AppearanceContext';
import { useAuth } from './AuthContext';

const DEFAULT_APPEARANCE = { finish: 'obsidian', accent: 'gold', presence: 'editorial' };

const STORAGE_ROOT = 'toca.appearance';

const keyFor = (userId) => (userId ? `${STORAGE_ROOT}.${userId}` : STORAGE_ROOT);

// Reads + validates a stored appearance blob. Anything that isn't one of
// the known values per axis is dropped rather than ever reaching
// document.documentElement.classList.add() — a corrupted/old localStorage
// entry should never inject an unknown class name.
function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const next = { ...DEFAULT_APPEARANCE };
    let sawValid = false;
    for (const axis of Object.keys(APPEARANCE_CLASS)) {
      const value = parsed?.[axis];
      if (value && Object.prototype.hasOwnProperty.call(APPEARANCE_CLASS[axis], value)) {
        next[axis] = value;
        sawValid = true;
      }
    }
    return sawValid ? next : null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-mode Safari (and quota-exceeded elsewhere) throws on write —
    // the appearance still applies for this session, it just won't persist.
  }
}

function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

/**
 * Owns the three Appearance axes (Finish/Accent/Presence) and is the ONLY
 * code allowed to touch the finish-, accent-, and presence- classes on
 * document.documentElement (<html>, same element as :root) — every
 * consumer goes through setAppearance/resetAppearance instead of the DOM
 * directly, so there's exactly one apply path.
 *
 * Classes go on <html>, not <body>, and this matters for correctness, not
 * just convention: design-tokens.css's --color-* compatibility aliases
 * (--color-primary: var(--y-base), --color-border-focus: var(--y-glow),
 * etc.) are declared once in :root. A custom property's var() references
 * resolve using the SAME element's cascade at the point the alias itself
 * is declared, and that resolved (literal) value is what inherits down —
 * descendants don't get a live re-evaluation. So if the override class
 * lived on <body>, every one of those :root-declared aliases would stay
 * frozen on the Obsidian/Gold default forever, no matter what a
 * descendant's --y-base says — only tokens consumed directly (no alias
 * indirection) would visibly change. Putting the class on :root's own
 * element closes that gap.
 *
 * Storage is keyed per-admin (`toca.appearance.<userId>`) once AuthContext
 * resolves who's logged in, so two admins on a shared machine don't clobber
 * each other's preference. Before that resolves (Login screen, initial
 * auth check) it reads/writes the unscoped `toca.appearance` bucket.
 */
export function AppearanceProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [appearance, setAppearanceState] = useState(() => (
    readStored(keyFor(userId)) || readStored(STORAGE_ROOT) || DEFAULT_APPEARANCE
  ));
  const [hasStoredAppearance, setHasStoredAppearance] = useState(() => readStored(keyFor(userId)) !== null);

  // Re-key once the admin's identity resolves (e.g. right after login): pick
  // up that admin's own saved appearance if they have one, rather than
  // whatever was last active on this shared device. Adjusted during render
  // (React's documented pattern for "state needs to change when a prop
  // does") rather than in an effect, so it takes effect in the same commit
  // instead of firing one render late.
  const [lastSeenUserId, setLastSeenUserId] = useState(userId);
  if (userId !== lastSeenUserId) {
    setLastSeenUserId(userId);
    if (userId) {
      const scoped = readStored(keyFor(userId));
      if (scoped) {
        setAppearanceState(scoped);
        setHasStoredAppearance(true);
      } else {
        setHasStoredAppearance(false);
      }
    }
  }

  // Single apply path: strip every finish-*/accent-*/presence-* class and
  // re-add the current three, then persist. Nothing else may write to
  // document.documentElement.className. useLayoutEffect (not useEffect)
  // matters here: React flushes every layout effect in a commit before any
  // passive effect, regardless of tree depth — so any descendant reading
  // resolved token values via getComputedStyle in a plain useEffect (e.g.
  // Dashboard's chart color helper) is guaranteed to see the classes this
  // applies, never a stale prior frame.
  useLayoutEffect(() => {
    const root = document.documentElement;
    Object.values(APPEARANCE_CLASS).forEach((axisMap) => {
      Object.values(axisMap).forEach((cls) => { if (cls) root.classList.remove(cls); });
    });
    Object.keys(APPEARANCE_CLASS).forEach((axis) => {
      const cls = APPEARANCE_CLASS[axis][appearance[axis]];
      if (cls) root.classList.add(cls);
    });
    writeStored(keyFor(userId), appearance);
  }, [appearance, userId]);

  const setAppearance = useCallback((patch) => {
    setAppearanceState((prev) => {
      const next = { ...prev };
      for (const axis of Object.keys(patch || {})) {
        const value = patch[axis];
        if (APPEARANCE_CLASS[axis] && Object.prototype.hasOwnProperty.call(APPEARANCE_CLASS[axis], value)) {
          next[axis] = value;
        }
      }
      return next;
    });
    setHasStoredAppearance(true);
  }, []);

  const resetAppearance = useCallback(() => {
    setAppearanceState(DEFAULT_APPEARANCE);
    setHasStoredAppearance(false);
    removeStored(keyFor(userId));
  }, [userId]);

  const value = useMemo(
    () => ({ appearance, setAppearance, resetAppearance, hasStoredAppearance }),
    [appearance, setAppearance, resetAppearance, hasStoredAppearance]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}
