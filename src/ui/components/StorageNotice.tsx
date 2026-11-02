/**
 * Saved-data notices and recovery actions (REQ-010).
 *
 * Rendered once in the app shell so every screen tells the same story: storage
 * unavailable (play is still possible), an unreadable shard (never overwritten;
 * offer the allowed per-shard reset), or a failed write (progress may be lost).
 * Recovery actions remove only the affected shard.
 */
import { useState } from 'react';
import { usePreferences } from '../../store/preferences';
import { useScoundrelSnapshot, useScoundrelStore } from '../../store/useScoundrelStore';
import { Button } from './Button';

export function StorageNotice() {
  const { t } = usePreferences();
  const store = useScoundrelStore();
  const snapshot = useScoundrelSnapshot();
  const [dismissed, setDismissed] = useState(false);

  const hasRecovery = snapshot.recovery.length > 0;
  const hasWriteFailure = snapshot.warnings.some((warning) => warning.kind === 'write-failed');
  const visible = !snapshot.storageAvailable || hasRecovery || hasWriteFailure;
  if (!visible || (dismissed && !hasRecovery)) return null;

  const messages: string[] = [];
  if (!snapshot.storageAvailable) messages.push(t('storage.unavailable'));
  for (const warning of snapshot.warnings) {
    if (warning.kind === 'unreadable-data') {
      const base =
        warning.issue.shard === 'run'
          ? t('storage.unreadableRun')
          : warning.issue.shard === 'stats'
            ? t('storage.unreadableStats')
            : t('storage.unreadableSettings');
      const newer =
        warning.issue.status === 'unsupported-version' ? ` ${t('storage.newerVersion')}` : '';
      messages.push(`${base}${newer}`);
    } else if (warning.kind === 'write-failed') {
      messages.push(t('storage.writeFailed'));
    }
  }

  const shards = new Set(snapshot.recovery.map((issue) => issue.shard));

  return (
    <section className="storage-notice" aria-label={t('a11y.storageNotice')}>
      <div className="storage-notice__body">
        <h2 className="storage-notice__title">{t('storage.title')}</h2>
        {messages.map((message) => (
          <p key={message} className="storage-notice__message">
            {message}
          </p>
        ))}
        {hasRecovery ? (
          <div className="storage-notice__recovery">
            <p className="storage-notice__recovery-title">{t('storage.recovery')}</p>
            {shards.has('run') ? (
              <Button variant="secondary" onClick={() => store.discardUnreadableRun()}>
                {t('storage.discardRun')}
              </Button>
            ) : null}
            {shards.has('stats') ? (
              <Button variant="secondary" onClick={() => store.resetUnreadableStats()}>
                {t('storage.resetStats')}
              </Button>
            ) : null}
            {shards.has('settings') ? (
              <Button variant="secondary" onClick={() => store.resetUnreadableSettings()}>
                {t('storage.resetSettings')}
              </Button>
            ) : null}
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            {t('storage.dismiss')}
          </Button>
        )}
      </div>
    </section>
  );
}
