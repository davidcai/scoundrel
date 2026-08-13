import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'

/**
 * Accessible pixel tooltip.
 * - Mouse: shows on hover.
 * - Keyboard: shows on focus, hides on blur; Escape closes while focus stays
 *   on the trigger (focus is never moved, so nothing has to be "returned").
 * - Touch: tap-and-hold (>= 450 ms) shows it; release/move/scroll hides it.
 *
 * The trigger is passed as a render prop receiving `tooltipProps`
 * (`id` + `aria-describedby`), so the ARIA relationship lands on the real
 * focusable element (button/card), not a wrapper.
 *
 * Usage:
 *   <Tooltip content="Monster — deals its value in damage">
 *     {(props) => <PixelButton {...props}>Fight</PixelButton>}
 *   </Tooltip>
 */

const LONG_PRESS_MS = 450

interface TooltipProps {
  content: ReactNode
  /** Render below the trigger instead of above (e.g. items near the top edge). */
  placement?: 'top' | 'bottom'
  children: (tooltipProps: { 'aria-describedby'?: string }) => ReactNode
}

export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearPressTimer()
    setOpen(false)
  }, [clearPressTimer])

  useEffect(() => hide, [hide])

  const onPointerEnter = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === 'mouse') {
      setOpen(true)
    }
  }

  const onPointerLeave = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === 'mouse') {
      hide()
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse') {
      clearPressTimer()
      pressTimer.current = setTimeout(() => {
        setOpen(true)
      }, LONG_PRESS_MS)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      hide()
    }
  }

  return (
    <span
      className="tooltip-trigger"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={hide}
      onPointerCancel={hide}
      onFocusCapture={() => {
        setOpen(true)
      }}
      onBlurCapture={hide}
      onKeyDown={onKeyDown}
    >
      {children({ 'aria-describedby': open ? id : undefined })}
      {open && (
        <span
          className={['tooltip-bubble', placement === 'bottom' && 'tooltip-bubble--below']
            .filter(Boolean)
            .join(' ')}
          role="tooltip"
          id={id}
        >
          {content}
        </span>
      )}
    </span>
  )
}
