import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Contenido a la derecha del título (acciones, ayuda). */
  aside?: ReactNode;
  as?: 'section' | 'div';
  sticky?: boolean;
}

/** Tarjeta: fondo blanco, borde 1 px, radio 4, padding 24. */
export function Card({ title, aside, as: Tag = 'section', sticky, className, children, ...rest }: CardProps) {
  return (
    <Tag className={`${styles.card} ${sticky ? styles.sticky : ''} ${className ?? ''}`} {...rest}>
      {(title || aside) && (
        <div className={styles.head}>
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </Tag>
  );
}
