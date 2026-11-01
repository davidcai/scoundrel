import { decodeReplay } from '../engine';
import { resumeSession, sameRun } from './persistence';
import type { SaveData } from './persistence';
import { sessionReducer } from './session';
export function bootstrap(data: SaveData, hash: string, marker: unknown, at: number) {
  const restored = { ...data, session: resumeSession(data.session) };
  if (!hash || hash === '#/' || hash === '#main')
    return { data: restored, linkError: false, changed: false };
  try {
    const { seed, config } = decodeReplay(hash);
    if (marker === data.session.runNumber && sameRun(data.session.game, seed, config))
      return { data: restored, linkError: false, changed: false };
    return {
      data: { ...data, session: sessionReducer(data.session, { type: 'start', seed, config, at }) },
      linkError: false,
      changed: true,
    };
  } catch {
    return { data: restored, linkError: true, changed: false };
  }
}
