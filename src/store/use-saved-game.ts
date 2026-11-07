import { useEffect, useRef, useState } from 'react';
import { bootstrap } from './bootstrap';
import { decodeSave, emptySave, SaveConflict, UnsupportedSave } from './persistence';
import { readSave, writeSave } from './save-storage';
import type { Preferences, SaveData } from './persistence';
import { sessionReducer } from './session';
import type { SessionAction } from './session';
export type SaveProblem =
  'unreadable' | 'unsupported' | 'unavailable' | 'write-failed' | 'conflict';
export async function loadSavedGame() {
  let data = emptySave();
  let raw: string | null = null;
  let problem: SaveProblem | null = null;
  try {
    raw = await readSave();
    if (raw !== null) {
      try {
        data = decodeSave(raw);
      } catch (error) {
        problem = error instanceof UnsupportedSave ? 'unsupported' : 'unreadable';
      }
    }
  } catch {
    problem = 'unavailable';
  }
  const initial = bootstrap(data, location.hash, history.state?.scoundrelRun, Date.now());
  return { ...initial, raw, problem };
}
export type InitialSave = Awaited<ReturnType<typeof loadSavedGame>>;
export function useSavedGame(initial: InitialSave) {
  const [data, setData] = useState(initial.data);
  const [problem, setProblem] = useState<SaveProblem | null>(initial.problem);
  const [isSaving, setIsSaving] = useState(initial.changed && !initial.problem);
  const current = useRef(data);
  const previousRaw = useRef(initial.raw);
  const currentProblem = useRef(problem);
  const initialized = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  function issue(next: SaveProblem | null) {
    currentProblem.current = next;
    setProblem(next);
  }
  function hasConflict() {
    return currentProblem.current === 'conflict';
  }
  function markEntry(next: SaveData) {
    history.replaceState(
      { ...history.state, scoundrelRun: next.session.runNumber },
      '',
      location.href,
    );
  }
  function commit(update: (latest: SaveData) => SaveData, persist = true): Promise<boolean> {
    if (hasConflict()) return Promise.resolve(false);
    const next = update(current.current);
    current.current = next;
    setData(next);
    if (!persist) return Promise.resolve(true);
    pending.current++;
    setIsSaving(true);
    const task = queue.current.then(async () => {
      if (hasConflict()) return false;
      if (
        persist &&
        currentProblem.current !== 'unreadable' &&
        currentProblem.current !== 'unsupported' &&
        currentProblem.current !== 'unavailable'
      ) {
        try {
          await writeSave(next, previousRaw);
          channel.current?.postMessage('changed');
          // A later writer may have changed storage since this transaction committed.
          if (hasConflict()) return false;
          issue(null);
        } catch (error) {
          if (error instanceof SaveConflict) {
            issue('conflict');
            return false;
          }
          issue('write-failed');
        }
      }
      markEntry(next);
      return true;
    });
    queue.current = task.then(
      () => undefined,
      () => undefined,
    );
    return task.finally(() => {
      pending.current--;
      setIsSaving(pending.current > 0);
    });
  }
  function dispatch(action: SessionAction) {
    return commit((latest) => {
      const timed =
        action.type === 'start' || action.type === 'act' || action.type === 'discard'
          ? { ...action, at: Date.now() }
          : action;
      return { ...latest, session: sessionReducer(latest.session, timed) };
    }, action.type !== 'select');
  }
  function preferences(
    patch: Partial<Preferences> | ((latest: Preferences) => Partial<Preferences>),
  ) {
    return commit((latest) => ({
      ...latest,
      preferences: {
        ...latest.preferences,
        ...(typeof patch === 'function' ? patch(latest.preferences) : patch),
      },
    }));
  }
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (initial.changed) void commit(() => initial.data);
      else markEntry(initial.data);
    }
    let disposed = false;
    function checkSavedRevision() {
      const check = queue.current.then(async () => {
        try {
          const raw = await readSave();
          if (!disposed && raw !== previousRaw.current) issue('conflict');
        } catch {
          // A failed check does not authorize overwriting the last saved revision.
        }
      });
      queue.current = check;
    }
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('scoundrel:saves');
      channel.current.onmessage = checkSavedRevision;
    }
    window.addEventListener('focus', checkSavedRevision);
    return () => {
      disposed = true;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener('focus', checkSavedRevision);
    };
  }, []);
  return {
    data,
    dispatch,
    preferences,
    problem,
    isSaving,
    initialLinkError: initial.linkError,
    retry: () => {
      if (currentProblem.current === 'write-failed') void commit((latest) => latest);
    },
  };
}
