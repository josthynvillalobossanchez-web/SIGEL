import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Altura del botón: 44 (por defecto), 48, 56 o 72 (acción principal de cobro). */
  height?: 44 | 48 | 56 | 72;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', height = 44, block, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[variant], block ? styles.block : '', className ?? ''].join(' ');
  return (
    <button type={type} className={cls} style={{ height: variant === 'link' ? undefined : height }} {...rest}>
      {icon}
      {children}
    </button>
  );
}
