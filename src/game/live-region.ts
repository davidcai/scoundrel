import { useGameStore, type Announcement } from '../store/game-store';

/**
 * Off-screen DOM live region for screen-reader announcements, fed from the
 * zustand store's `announcement` slice (strings built in store/announcements).
 * The canvas renders everything visual; this is the only a11y DOM surface.
 */
export function installLiveRegion(): void {
  const div = document.createElement('div');
  div.setAttribute('aria-live', 'polite');
  div.setAttribute('role', 'status');
  div.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
  document.body.appendChild(div);

  let last: Announcement | null = null;
  useGameStore.subscribe((state) => {
    if (state.announcement && state.announcement !== last) {
      last = state.announcement;
      // Clear first so an identical consecutive message still re-announces.
      div.textContent = '';
      div.textContent = state.announcement.message;
    }
  });
}
