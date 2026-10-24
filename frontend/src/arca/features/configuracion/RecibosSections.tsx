import { useEffect, useId, useState, type FormEvent } from 'react';
import type { PrintFormat, Settings } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field, TextInput } from '../../components/Field';
import { Icon } from '../../components/Icon';
import pages from '../../components/pages.module.css';
import { errorMessage } from '../../lib/useAsync';
import { useSettings } from '../../store/settings';
import styles from './Configuracion.module.css';

/** Datos municipales que se imprimen en el encabezado de cada recibo. */
export function MunicipalSection() {
  const { settings, save } = useSettings();
  const [legalId, setLegalId] = useState(settings.municipalLegalId);
  const [phone, setPhone] = useState(settings.municipalPhone);
  const [address, setAddress] = useState(settings.municipalAddress);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // La configuración se lee al entrar a la app; si llega después de abrir esta sección, se refleja.
  useEffect(() => {
    setLegalId(settings.municipalLegalId);
    setPhone(settings.municipalPhone);
    setAddress(settings.municipalAddress);
  }, [settings.municipalLegalId, settings.municipalPhone, settings.municipalAddress]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await save({ ...settings, municipalLegalId: legalId, municipalPhone: phone, municipalAddress: address });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 640 }}>
      <Card title="Datos municipales del recibo">
        <p className={pages.muted} style={{ marginTop: 0 }}>
          Aparecen en el encabezado del tiquete y de la hoja carta. Los recibos ya emitidos mostrarán los datos vigentes al reimprimirse.
        </p>
        <div className={pages.formGrid}>
          <Field label="Cédula jurídica">
            <TextInput value={legalId} onChange={(e) => setLegalId(e.target.value)} maxLength={60} autoComplete="off" />
          </Field>
          <Field label="Teléfono">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={60} inputMode="tel" autoComplete="off" />
          </Field>
          <Field label="Dirección">
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} autoComplete="off" />
          </Field>
        </div>
        {error && <Alert className={pages.mt16}>{error}</Alert>}
        {saved && <Alert tone="info" className={pages.mt16}>Datos guardados.</Alert>}
        <div className={pages.actions}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </Card>
    </form>
  );
}

const FORMATS: { value: PrintFormat; label: string; help: string }[] = [
  { value: 'TERMICO', label: 'Tiquete 80 mm', help: 'Impresoras térmicas de ticket' },
  { value: 'CARTA', label: 'Hoja carta', help: 'Impresoras láser o de inyección' },
];

/** Formato de impresión por defecto e impresión automática. La impresora se elige en el equipo de cada ventanilla. */
export function PrintSection() {
  const { settings, save } = useSettings();
  const [format, setFormat] = useState<PrintFormat>(settings.printFormat);
  const [auto, setAuto] = useState(settings.autoPrint);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const legend = useId();

  useEffect(() => {
    setFormat(settings.printFormat);
    setAuto(settings.autoPrint);
  }, [settings.printFormat, settings.autoPrint]);

  // La página de prueba se monta fuera de pantalla y se imprime con el formato elegido.
  useEffect(() => {
    if (!testing) return;
    const id = window.setTimeout(() => {
      window.print();
      setTesting(false);
    }, 100);
    return () => window.clearTimeout(id);
  }, [testing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await save({ ...settings, printFormat: format, autoPrint: auto });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 640 }}>
      <Card title="Impresión">
        <fieldset className={styles.fieldset} aria-labelledby={legend}>
          <legend id={legend} className={styles.legend}>
            Formato por defecto
          </legend>
          <div className={styles.formats} role="radiogroup" aria-labelledby={legend}>
            {FORMATS.map((f) => (
              <label key={f.value} className={`${styles.format} ${format === f.value ? styles.formatOn : ''}`}>
                <input type="radio" name="print-format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} />
                <span>
                  <b>{f.label}</b>
                  <span className={styles.formatHelp}>{f.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.check}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Imprimir automáticamente al cobrar
        </label>

        <div className={styles.note}>
          <Icon name="printer" size={18} />
          <p>
            ARCA imprime con el diálogo de impresión del sistema, así que funciona con <b>cualquier impresora instalada en el equipo</b>,
            incluidas las térmicas de 80 mm con su controlador. Elija la impresora predeterminada de cada ventanilla en Windows y use
            «Imprimir página de prueba» para verificar el formato. La impresión directa a impresoras térmicas (sin diálogo) queda
            pendiente hasta definir el modelo.
          </p>
        </div>

        {error && <Alert className={pages.mt16}>{error}</Alert>}
        {saved && <Alert tone="info" className={pages.mt16}>Configuración guardada.</Alert>}
        <div className={pages.actions}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button icon={<Icon name="printer" size={16} />} onClick={() => setTesting(true)} disabled={testing}>
            Imprimir página de prueba
          </Button>
        </div>
      </Card>
      {testing && (
        <div className="print-only" aria-hidden="true">
          <div className={`print-area ${format === 'CARTA' ? styles.testLetter : styles.testTicket}`}>
            <img src="/arca/logo-negro.svg" alt="" style={{ height: 44 }} />
            <p>
              <b>ARCA · Prueba de impresión</b>
            </p>
            <p>Formato: {format === 'CARTA' ? 'Hoja carta' : 'Tiquete 80 mm'}</p>
            <p>Si ve este texto completo y sin cortes, el formato es el correcto.</p>
            <p>₡1.234.567,89</p>
          </div>
        </div>
      )}
    </form>
  );
}

export type { Settings };
