import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * Native button with the approved visual states. Unavailable actions use
 * `aria-disabled` rather than the native `disabled` attribute so they stay
 * focusable and can explain their restriction (REQ-004, design plan §5).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('button', `button--${variant}`, className)}
      {...rest}
    />
  );
});
