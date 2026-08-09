interface HealthBarProps {
  health: number;
  max: number;
}

export default function HealthBar({ health, max }: HealthBarProps) {
  const displayHealth = Math.max(0, health);
  const pct = Math.max(0, Math.min(100, (displayHealth / max) * 100));
  const ratio = displayHealth / max;
  const fillClass = ratio <= 0.3 ? 'health-low' : ratio <= 0.6 ? 'health-mid' : '';

  return (
    <div className="health-bar">
      <div className="health-bar-track">
        <div className={`health-bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="health-bar-label">
        <span className="health-icon">♥</span>
        <span>
          {displayHealth} / {max}
        </span>
      </div>
    </div>
  );
}
