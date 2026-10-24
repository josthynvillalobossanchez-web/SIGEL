import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { receiptsApi } from '../../api/endpoints';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { ReceiptView, type ReceiptFormat } from '../../components/ReceiptView';
import { useAsync } from '../../lib/useAsync';
import { receiptFormatOf, useSettings } from '../../store/settings';
import styles from './ReciboPage.module.css';

/** Vista del recibo (imprimible). Se llega desde Recibos, Nuevo recibo (tras cobrar) y Anulaciones; no está en el menú. */
export function ReciboPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultFormat = receiptFormatOf(useSettings((s) => s.settings.printFormat));
  const [chosen, setFormat] = useState<ReceiptFormat | null>(null);
  const format = chosen ?? defaultFormat;
  const receipt = useAsync(() => receiptsApi.get(Number(id)), [id]);
  const printed = useRef(false);

  const r = receipt.data;

  function print() {
    if (!r) return;
    window.print();
    // La reimpresión queda en la bitácora; si falla el registro, la impresión ya se hizo.
    void receiptsApi.logPrint(r.id, format === 'termico' ? 'THERMAL' : 'LETTER').catch(() => undefined);
  }

  // "Reimprimir" desde la lista llega con ?print=1: imprime una sola vez al cargar.
  useEffect(() => {
    if (r && params.get('print') === '1' && !printed.current) {
      printed.current = true;
      setParams({}, { replace: true });
      const t = window.setTimeout(print, 150);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  return (
    <>
      <PageHeader
        title="Vista del recibo"
        subtitle={r ? `Recibo Nº ${r.number}` : 'Impresión en blanco y negro'}
        actions={
          <>
            <div className={styles.segmented} role="group" aria-label="Formato de impresión">
              <button type="button" aria-pressed={format === 'termico'} className={format === 'termico' ? styles.on : ''} onClick={() => setFormat('termico')}>
                Tiquete 80 mm
              </button>
              <button type="button" aria-pressed={format === 'carta'} className={format === 'carta' ? styles.on : ''} onClick={() => setFormat('carta')}>
                Hoja carta
              </button>
            </div>
            {r?.voidable && (
              <Button variant="danger" icon={<Icon name="ban" size={16} />} onClick={() => navigate(`/cobro/anulaciones?recibo=${r.id}`)}>
                Anular recibo
              </Button>
            )}
            <Button variant="primary" icon={<Icon name="printer" size={16} />} onClick={print} disabled={!r}>
              Imprimir
            </Button>
          </>
        }
      />
      {receipt.error && <Alert>{receipt.error.status === 404 ? 'El recibo no existe.' : receipt.error.message}</Alert>}
      {receipt.loading && !r && <p role="status">Cargando recibo…</p>}
      {r && (
        <div className={styles.canvas}>
          <ReceiptView receipt={r} format={format} />
        </div>
      )}
    </>
  );
}
