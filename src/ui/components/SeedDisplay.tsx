import { usePreferences } from '../../store/preferences';

/** The run seed as plain mono text with a visible "Seed:" prefix, named for assistive tech. */
export function SeedDisplay({ seed, className }: { seed: string; className?: string }) {
  const { t } = usePreferences();

  return (
    <span className={className === undefined ? 'seed' : `seed ${className}`}>
      <span className="seed__label">{t('play.seedPrefix')}</span>
      <code className="seed__value" aria-label={t('a11y.seed', { seed })}>
        {seed}
      </code>
    </span>
  );
}
