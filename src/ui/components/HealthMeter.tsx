import { useId } from 'react';
import { formatHealth } from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';

/**
 * Visible health text plus a named progressbar. The visible label doubles as
 * the accessible name and the value text spells out the same numbers (REQ-004,
 * REQ-017).
 */
export function HealthMeter({ health, max }: { health: number; max: number }) {
  const { t } = usePreferences();
  const labelId = useId();
  const ratio = Math.max(0, Math.min(1, health / max));
  const tone = health >= 15 ? null : health >= 8 ? 'wounded' : 'critical';

  return (
    <div className={tone === null ? 'health' : `health health--${tone}`}>
      <span className="health__label" id={labelId}>
        <span className="health__prefix">{t('play.healthPrefix')}</span>{' '}
        <span className="health__value">{t('play.healthValue', { health, max })}</span>
      </span>
      <div
        className="health__track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={health}
        aria-valuetext={formatHealth(t, health)}
      >
        <span className="health__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
