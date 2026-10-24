import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { formatAmountInput, parseAmount, parseQuantity } from '../lib/money';
import styles from './MoneyInput.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  value: number;
  onValueChange: (value: number) => void;
  /** Cantidad entera (sin decimales) en lugar de monto. */
  integer?: boolean;
  /** Alto: 40 px dentro de tablas (por defecto), 44 estándar, 48 para el efectivo recibido. */
  size?: 40 | 44 | 48;
  large?: boolean;
}

/**
 * Entrada numérica en formato es-CR ("." miles, "," decimales), alineada a la derecha. Actualiza el valor en cada
 * tecla (así F9 cobra con lo último escrito) y normaliza el texto al salir del campo.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onValueChange, integer, size = 40, large, className, ...rest },
  ref,
) {
  const format = (n: number) => (integer ? (n ? String(n) : '') : formatAmountInput(n));
  const parse = (t: string) => (integer ? parseQuantity(t) : parseAmount(t));
  const [text, setText] = useState(format(value));

  // Si el valor cambia desde afuera (limpiar el borrador, cargar datos), refleja el nuevo texto.
  useEffect(() => {
    setText((prev) => (parse(prev) === value ? prev : format(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      className={`${styles.input} ${large ? styles.large : ''} ${className ?? ''}`}
      style={{ height: size }}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValueChange(parse(e.target.value));
      }}
      onBlur={() => setText(format(value))}
      {...rest}
    />
  );
});
