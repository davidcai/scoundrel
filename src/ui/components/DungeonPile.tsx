import { usePreferences } from '../../store/preferences';

/**
 * Remaining draw pile as a CSS card back (no card-back artwork exists yet; the
 * design plan requires CSS-only dungeon backs).
 */
export function DungeonPile({ count }: { count: number }) {
  const { t } = usePreferences();
  const remaining = t('play.dungeonRemaining', { count });

  return (
    <section className="dungeon" aria-label={t('a11y.dungeon')}>
      <h2 className="rail-title">{t('play.dungeonTitle')}</h2>
      <div className="dungeon__stack" aria-hidden="true">
        <span className="dungeon__back dungeon__back--1" />
        <span className="dungeon__back dungeon__back--2" />
        <span className="dungeon__back dungeon__back--3" />
        <span className="dungeon__count">{count}</span>
      </div>
      <p className="rail-caption">{remaining}</p>
    </section>
  );
}
