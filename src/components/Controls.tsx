interface ControlsProps {
  canRun: boolean;
  onRun: () => void;
  onRestart?: () => void;
}

export default function Controls({ canRun, onRun, onRestart }: ControlsProps) {
  return (
    <div className="controls">
      <button
        className="btn btn-run"
        onClick={onRun}
        disabled={!canRun}
        title={canRun ? 'Run away from this room' : 'Cannot run twice in a row'}
      >
        Run Away
      </button>
      {onRestart && (
        <button className="btn btn-restart" onClick={onRestart}>
          Restart
        </button>
      )}
    </div>
  );
}
