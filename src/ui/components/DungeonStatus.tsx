import { usePreferences } from '../../store/preferences';

/**
 * Remaining draw pile as a compact inline status. It sits beside the health
 * meter in the play header, so the count stays visible without a third rail.
 * The visible text and the accessible name both state the total (REQ-004).
 */
export function DungeonStatus({ count }: { count: number }) {
  const { t } = usePreferences();

  return (
    <span className="dungeon-status" role="img" aria-label={t('a11y.dungeonCount', { count })}>
      <span className="dungeon-status__title">{t('play.dungeonTitle')}</span>
      <span className="dungeon-status__caption">{t('play.dungeonRemaining', { count })}</span>
    </span>
  );
}
