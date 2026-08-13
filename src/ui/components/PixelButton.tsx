import type { ComponentProps, Ref } from 'react'

export type PixelButtonVariant = 'steel' | 'ember' | 'ghost'

interface PixelButtonProps extends ComponentProps<'button'> {
  variant?: PixelButtonVariant
  /** React 19: ref is a plain prop (no forwardRef needed). */
  ref?: Ref<HTMLButtonElement>
}

export function PixelButton({
  variant = 'steel',
  className,
  type,
  ref,
  ...rest
}: PixelButtonProps) {
  const variantClass = variant === 'steel' ? '' : `pixel-button--${variant}`
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={['pixel-button', variantClass, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
