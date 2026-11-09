import { useEffect, useId, useRef, type Dispatch } from 'react';
import type { AttackMode, CardId } from '../../engine';
import {
  describeCardPreview,
  describeEvent,
  describeMonsterPreview,
  formatCardName,
  formatRoomLabel,
  rejectionText,
} from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import type { UiAction, UiSession } from '../../store/gameSession';
import {
  getActionAvailability,
  getCardViews,
  getDungeonCount,
  getHealthView,
  getRoomNumber,
  getWeaponView,
} from '../../store/selectors';
import { ActionBar } from '../components/ActionBar';
import { Button } from '../components/Button';
import { useAnnounce } from '../components/Announcer';
import { DungeonStatus } from '../components/DungeonStatus';
import { HealthMeter } from '../components/HealthMeter';
import { PreviewPanel } from '../components/PreviewPanel';
import { RoomGrid } from '../components/RoomGrid';
import { SeedDisplay } from '../components/SeedDisplay';
import { WeaponRail } from '../components/WeaponRail';
import { preloadArtwork } from '../artwork';

export interface PlayScreenProps {
  session: UiSession;
  dispatch: Dispatch<UiAction>;
  /** True when this session cannot be persisted (storage unavailable or a bad run shard). */
  sessionOnly?: boolean;
  /** Return to the title without discarding the saved run. */
  onBackToTitle: () => void;
}

/**
 * The play screen: room cards, selection preview, weapon and kill stack,
 * draw-pile status in the header, seed in the action bar, and the room actions.
 *
 * The play surface always uses the wide desktop composition; narrower viewports
 * scroll horizontally rather than switching layouts. A new room focuses its
 * first card; clearing a room focuses the enabled "Enter next room"; undo
 * focuses the restored selection.
 */
export function PlayScreen({
  session,
  dispatch,
  sessionOnly = false,
  onBackToTitle,
}: PlayScreenProps) {
  const { t } = usePreferences();
  const announce = useAnnounce();

  const firstCardRef = useRef<HTMLButtonElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const roomHeadingId = useId();
  const roomHintId = useId();
  const previewTitleId = useId();
  const skipTargetId = useId();

  const { state } = session;
  const health = getHealthView(state);
  const availability = getActionAvailability(state);
  const weapon = getWeaponView(state);
  const cardViews = getCardViews(state, session.selectedCard);
  const roomNumber = getRoomNumber(state);
  const dungeonCount = getDungeonCount(state);
  const roomSignature = state.room.cards.map((card) => card.card).join('|');
  const weaponValue = state.weapon?.value ?? null;

  // Refs keep the focus effect from re-firing when only the selection changes.
  const selectedRef = useRef(session.selectedCard);
  selectedRef.current = session.selectedCard;

  // Announce resolved outcomes once per notice, and invalidity assertively.
  useEffect(() => {
    if (session.notice === null) return;
    if (session.notice.kind === 'event') {
      announce(describeEvent(t, session.notice.event), 'polite');
    } else {
      announce(rejectionText(t, session.notice.reason), 'assertive');
    }
  }, [session.notice, session.noticeSeq, announce, t]);

  // Announce selection and its preview without resolving anything (REQ-005/007).
  useEffect(() => {
    if (session.selectedCard === null) return;
    if (session.previewRejection !== null) {
      announce(rejectionText(t, session.previewRejection), 'assertive');
      return;
    }
    if (session.preview === null) return;
    const cardName = formatCardName(t, session.selectedCard);
    const summary =
      session.preview.kind === 'monster'
        ? describeMonsterPreview(t, session.preview.preview, weaponValue)
        : describeCardPreview(t, session.preview, { health: state.health, weaponValue });
    announce(t('a11y.selectedAnnounce', { cardName, summary }), 'polite');
  }, [
    session.selectedCard,
    session.preview,
    session.previewRejection,
    announce,
    t,
    state.health,
    weaponValue,
  ]);

  // Context-specific focus after deals, resolutions, room clears, and undo.
  useEffect(() => {
    if (document.querySelector('[role="dialog"]') !== null) return;

    const notice = session.notice;
    if (notice !== null && notice.kind === 'event') {
      if (notice.event.type === 'undoRoom') {
        // Undo restores the selection; focus that card so play can continue.
        const restored = selectedRef.current;
        const target =
          restored === null
            ? null
            : document.querySelector<HTMLButtonElement>(`.card[data-card="${restored}"]`);
        (target ?? firstCardRef.current)?.focus();
        return;
      }
      if (notice.event.type === 'cardResolved' && state.roomCleared) {
        // The room is finished: the next step is the (now enabled) room action.
        if (availability.enterNextRoom.enabled) enterButtonRef.current?.focus();
        else firstCardRef.current?.focus();
        return;
      }
    }

    firstCardRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roomSignature,
    state.highlights.roomsExplored,
    session.noticeSeq,
    availability.enterNextRoom.enabled,
  ]);

  // Warm the next room's artwork without blocking the current room.
  useEffect(() => {
    preloadArtwork(state.dungeon.slice(0, 4));
  }, [state.dungeon]);

  // When a selection is cleared (Escape, clicking the card again, or the sheet
  // close button), return focus to that card once the modal has unmounted.
  const previousSelectedRef = useRef<CardId | null>(null);
  useEffect(() => {
    const previous = previousSelectedRef.current;
    previousSelectedRef.current = session.selectedCard;
    if (previous === null || session.selectedCard !== null) return;
    if (document.querySelector('[role="dialog"]') !== null) return;
    document.querySelector<HTMLButtonElement>(`.card[data-card="${previous}"]`)?.focus();
  }, [session.selectedCard]);

  // Escape clears the current card selection.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (session.selectedCard === null) return;
      dispatch({ type: 'clearSelection' });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [session.selectedCard, dispatch]);

  const handleSelect = (card: CardId) => {
    if (session.selectedCard === card) dispatch({ type: 'clearSelection' });
    else dispatch({ type: 'select', card });
  };

  const handleConfirm = (attack?: AttackMode) => {
    dispatch({ type: 'resolve', ...(attack === undefined ? {} : { attack }) });
  };

  const roomActions = (
    <ActionBar
      enterButtonRef={enterButtonRef}
      availability={availability}
      onEnterNextRoom={() => dispatch({ type: 'enterNextRoom' })}
      onRunAway={() => dispatch({ type: 'runAway' })}
      onUndo={() => dispatch({ type: 'undoRoom' })}
    />
  );

  return (
    <div className="play-screen">
      <div className="play-screen__content">
        <a
          className="skip-link"
          href={`#${skipTargetId}`}
          onClick={(event) => {
            event.preventDefault();
            firstCardRef.current?.focus();
          }}
        >
          {t('app.skipLink')}
        </a>

        <header className="play-header">
          <div className="play-header__status">
            <HealthMeter health={health.health} max={health.max} />
            <DungeonStatus count={dungeonCount} />
          </div>
          <div className="play-header__right">
            {sessionOnly ? (
              <span className="play-header__unsaved">{t('play.sessionOnly')}</span>
            ) : null}
            <Button
              variant="ghost"
              className="play-header__menu"
              aria-label={t('play.backToTitle')}
              onClick={onBackToTitle}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </Button>
          </div>
        </header>

        <main className="play-main">
          <div className="play-main__weapon">
            <WeaponRail view={weapon} />
          </div>

          <section className="play-main__room" aria-labelledby={roomHeadingId}>
            <h1 className="room-title" id={roomHeadingId} tabIndex={-1}>
              {formatRoomLabel(t, roomNumber, state.finalRoom)}
            </h1>
            <p className="room-hint" id={roomHintId}>
              {state.roomCleared ? (
                t('play.roomHintCleared')
              ) : (
                <>
                  <span className="room-hint__full">{t('play.roomHint')}</span>
                  <span className="room-hint__short">{t('play.roomHintShort')}</span>
                </>
              )}
            </p>
            <div
              className="room-grid-wrap"
              id={skipTargetId}
              tabIndex={-1}
              aria-describedby={roomHintId}
            >
              <RoomGrid views={cardViews} onSelect={handleSelect} firstCardRef={firstCardRef} />
            </div>
            <div className="play-main__preview">
              <PreviewPanel
                session={session}
                titleId={previewTitleId}
                onConfirm={handleConfirm}
                roomActions={roomActions}
              />
            </div>
          </section>
        </main>
      </div>

      <div className="play-screen__seed">
        <SeedDisplay seed={state.seed} />
      </div>
    </div>
  );
}
