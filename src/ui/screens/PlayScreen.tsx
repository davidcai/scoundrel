import { useEffect, useId, useRef, useState, type CSSProperties, type Dispatch } from 'react';
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
  getPotionStatus,
  getRoomNumber,
  getWeaponView,
} from '../../store/selectors';
import { ActionBar } from '../components/ActionBar';
import { useAnnounce } from '../components/Announcer';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { DungeonPile } from '../components/DungeonPile';
import { HealthMeter } from '../components/HealthMeter';
import { HelpDialog } from '../components/HelpDialog';
import { PotionIndicator } from '../components/PotionIndicator';
import { PreviewPanel } from '../components/PreviewPanel';
import { RoomGrid } from '../components/RoomGrid';
import { SeedDisplay } from '../components/SeedDisplay';
import { StatusLine } from '../components/StatusLine';
import { WeaponRail } from '../components/WeaponRail';
import { preloadArtwork } from '../artwork';
import { useMediaQuery } from '../hooks/useMediaQuery';

export interface PlayScreenProps {
  session: UiSession;
  dispatch: Dispatch<UiAction>;
  /** True when this session cannot be persisted (storage unavailable or a bad run shard). */
  sessionOnly?: boolean;
}

/**
 * The play screen: room cards, selection preview, weapon and kill stack,
 * draw pile, persistent status line, and the room actions.
 *
 * Focus policy (design plan §7): a new room focuses its heading on compact and
 * its first card on wider layouts; clearing a room focuses the enabled "Enter
 * next room"; undo focuses the restored selection.
 */
export function PlayScreen({ session, dispatch, sessionOnly = false }: PlayScreenProps) {
  const { t } = usePreferences();
  const announce = useAnnounce();
  const compact = useMediaQuery('(max-width: 767px)');
  const [helpOpen, setHelpOpen] = useState(false);
  const [actionBarHeight, setActionBarHeight] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLButtonElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const roomHeadingId = useId();
  const roomHintId = useId();
  const previewTitleId = useId();
  const skipTargetId = useId();

  const { state } = session;
  const health = getHealthView(state);
  const availability = getActionAvailability(state);
  const potion = getPotionStatus(state);
  const weapon = getWeaponView(state);
  const cardViews = getCardViews(state, session.selectedCard);
  const roomNumber = getRoomNumber(state);
  const dungeonCount = getDungeonCount(state);
  const roomSignature = state.room.cards.map((card) => card.card).join('|');
  const weaponValue = state.weapon?.value ?? null;

  // Refs keep the focus effect from re-firing when only the selection changes.
  const selectedRef = useRef(session.selectedCard);
  selectedRef.current = session.selectedCard;
  const previousRoomsRef = useRef<number | null>(null);
  const previousHelpRef = useRef(helpOpen);

  const statusText =
    session.notice === null
      ? state.roomCleared
        ? t('play.roomHintCleared')
        : t('play.roomHint')
      : session.notice.kind === 'event'
        ? describeEvent(t, session.notice.event)
        : rejectionText(t, session.notice.reason);

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
    const wasHelpOpen = previousHelpRef.current;
    previousHelpRef.current = helpOpen;
    if (helpOpen) return;
    if (wasHelpOpen) return;
    if (document.querySelector('[role="dialog"]') !== null) return;

    const previousRooms = previousRoomsRef.current;
    previousRoomsRef.current = state.highlights.roomsExplored;
    const dealt = previousRooms !== state.highlights.roomsExplored;

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

    if (compact) {
      // Compact: a freshly dealt room is read from its heading.
      if (dealt || notice === null) {
        headingRef.current?.focus();
        return;
      }
      firstCardRef.current?.focus();
      return;
    }

    firstCardRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roomSignature,
    state.highlights.roomsExplored,
    session.noticeSeq,
    compact,
    availability.enterNextRoom.enabled,
    helpOpen,
  ]);

  // Measure the sticky action bar so the compact preview sheet sits above it.
  useEffect(() => {
    const element = actionBarRef.current;
    if (element === null) return;
    const update = () => setActionBarHeight(element.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);

  // Warm the next room's artwork without blocking the current room.
  useEffect(() => {
    preloadArtwork(state.dungeon.slice(0, 4));
  }, [state.dungeon]);

  // When a selection is cleared (Cancel, Escape, or the sheet close button),
  // return focus to that card once the modal has unmounted.
  const previousSelectedRef = useRef<CardId | null>(null);
  useEffect(() => {
    const previous = previousSelectedRef.current;
    previousSelectedRef.current = session.selectedCard;
    if (previous === null || session.selectedCard !== null) return;
    if (document.querySelector('[role="dialog"]') !== null) return;
    document.querySelector<HTMLButtonElement>(`.card[data-card="${previous}"]`)?.focus();
  }, [session.selectedCard]);

  // Escape clears a wide-screen selection; the compact sheet handles its own Esc.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (session.selectedCard === null) return;
      if (document.querySelector('[role="dialog"]') !== null) return;
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

  const handleCancel = () => {
    dispatch({ type: 'clearSelection' });
  };

  const preview = (
    <PreviewPanel
      session={session}
      titleId={previewTitleId}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return (
    <div
      className="play-screen"
      style={{ '--action-bar-height': `${actionBarHeight}px` } as CSSProperties}
    >
      <div className="play-screen__content" ref={contentRef}>
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
          <HealthMeter health={health.health} max={health.max} />
          <div className="play-header__center">
            <span className="play-header__room">
              {formatRoomLabel(t, roomNumber, state.finalRoom)}
            </span>
            <span
              className="dungeon-chip"
              role="img"
              aria-label={t('a11y.dungeonCount', { count: dungeonCount })}
            >
              <span aria-hidden="true">{dungeonCount}</span>
            </span>
            <PotionIndicator status={potion} />
          </div>
          <div className="play-header__right">
            {sessionOnly ? (
              <span className="play-header__unsaved">{t('play.sessionOnly')}</span>
            ) : null}
            <SeedDisplay seed={state.seed} />
            <Button variant="ghost" onClick={() => setHelpOpen(true)}>
              {t('play.help')}
            </Button>
          </div>
        </header>

        <main className="play-main">
          <div className="play-main__weapon">
            <WeaponRail view={weapon} />
          </div>

          <section className="play-main__room" aria-labelledby={roomHeadingId}>
            <h1 className="room-title" id={roomHeadingId} tabIndex={-1} ref={headingRef}>
              {formatRoomLabel(t, roomNumber, state.finalRoom)}
            </h1>
            <p className="room-hint" id={roomHintId}>
              {state.roomCleared ? t('play.roomHintCleared') : t('play.roomHint')}
            </p>
            <div
              className="room-grid-wrap"
              id={skipTargetId}
              tabIndex={-1}
              aria-describedby={roomHintId}
            >
              <RoomGrid views={cardViews} onSelect={handleSelect} firstCardRef={firstCardRef} />
            </div>
            {!compact ? <div className="play-main__preview">{preview}</div> : null}
          </section>

          <div className="play-main__dungeon">
            <DungeonPile count={dungeonCount} />
          </div>
        </main>

        <StatusLine text={statusText} />

        <ActionBar
          ref={actionBarRef}
          enterButtonRef={enterButtonRef}
          availability={availability}
          onEnterNextRoom={() => dispatch({ type: 'enterNextRoom' })}
          onRunAway={() => dispatch({ type: 'runAway' })}
          onUndo={() => dispatch({ type: 'undoRoom' })}
          onHelp={() => setHelpOpen(true)}
        />
      </div>

      {compact && session.selectedCard !== null ? (
        <Dialog
          open
          titleId={previewTitleId}
          onClose={handleCancel}
          closeLabel={t('preview.close')}
          backgroundRef={contentRef}
          className="dialog__panel--sheet"
        >
          {preview}
        </Dialog>
      ) : null}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
