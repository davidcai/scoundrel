/** Persistent, visible description of the latest outcome (not a live region). */
export function StatusLine({ text }: { text: string }) {
  return (
    <p className="status-line" data-testid="status-line">
      {text}
    </p>
  );
}
