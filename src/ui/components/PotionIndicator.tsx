import { usePreferences } from '../../store/preferences';
import type { PotionStatus } from '../../store/selectors';

/** Per-room potion allowance, visible in the header (REQ-006). */
export function PotionIndicator({ status }: { status: PotionStatus }) {
  const { t } = usePreferences();
  const label = status.available
    ? t('play.potionAvailable')
    : status.unlimited
      ? t('rule.unlimitedPotions')
      : t('play.potionUsed');

  return <span className={status.available ? 'potion' : 'potion potion--used'}>{label}</span>;
}
