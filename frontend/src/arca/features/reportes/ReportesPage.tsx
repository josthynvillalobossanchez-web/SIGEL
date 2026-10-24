import { useState } from 'react';
import { reportsApi } from '../../api/endpoints';
import type { GroupBy } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Field, TextInput } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import pages from '../../components/pages.module.css';
import { reportGroupings } from '../../config/product';
import { firstOfMonth, isoDate } from '../../lib/dates';
import { formatColones } from '../../lib/money';
import { errorMessage, useAsync } from '../../lib/useAsync';
import styles from './ReportesPage.module.css';

/** Reportes de ingresos (solo cobros pagados; los anulados no suman) con exportación a PDF y Excel. */
export function ReportesPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>(reportGroupings[0].key);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(isoDate());
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const validRange = !!from && !!to && from <= to;
  const report = useAsync(() => (validRange ? reportsApi.revenue({ from, to, groupBy }) : Promise.resolve(undefined)), [from, to, groupBy, validRange]);
  const title = reportGroupings.find((g) => g.key === groupBy)?.title ?? 'Ingresos';
  const data = report.data;
  const max = data ? Math.max(...data.rows.map((r) => r.total), 0) : 0;

  async function doExport(format: 'pdf' | 'xlsx') {
    if (!validRange) return;
    setExporting(format);
    setExportError(null);
    try {
      await reportsApi.export(format, { from, to, groupBy });
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Ingresos cobrados en el rango elegido. Los recibos anulados no se suman."
        actions={
          <>
            <Button icon={<Icon name="download" size={16} />} disabled={!validRange || !!exporting} onClick={() => void doExport('pdf')}>
              Exportar PDF
            </Button>
            <Button icon={<Icon name="download" size={16} />} disabled={!validRange || !!exporting} onClick={() => void doExport('xlsx')}>
              Exportar Excel
            </Button>
          </>
        }
      />
      <div aria-live="polite">
        {exporting && (
          <div className={styles.progress} role="status">
            <span>Generando archivo…</span>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} />
            </div>
          </div>
        )}
        {exportError && <Alert className={pages.mt8}>{exportError}</Alert>}
      </div>

      <div className={styles.controls}>
        <div className={styles.segmented} role="group" aria-label="Agrupar por">
          {reportGroupings.map((g) => (
            <button key={g.key} type="button" aria-pressed={groupBy === g.key} className={groupBy === g.key ? styles.on : ''} onClick={() => setGroupBy(g.key)}>
              {g.label}
            </button>
          ))}
        </div>
        <Field label="Desde" className={styles.date}>
          <TextInput type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta" className={styles.date} error={from && to && from > to ? 'La fecha final debe ser posterior a la inicial.' : null}>
          <TextInput type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <Card title={title} aside={data && <b>Total {formatColones(data.total)}</b>}>
        {report.error && <Alert>{report.error.message}</Alert>}
        {data && data.rows.length === 0 && <EmptyState>Sin ingresos en el rango elegido.</EmptyState>}
        {data && data.rows.length > 0 && (
          <ul className={styles.bars} aria-label={title}>
            {data.rows.map((r) => (
              <li key={r.key} className={styles.barRow}>
                <span>{r.label}</span>
                <span className={styles.track} role="img" aria-label={`${r.label}: ${formatColones(r.total)}`}>
                  <span className={styles.fill} style={{ width: max > 0 ? `${(r.total / max) * 100}%` : 0 }} />
                </span>
                <span className={styles.amount}>
                  {formatColones(r.total)} <span className={pages.muted}>({r.count})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {report.loading && !data && <p role="status">Cargando…</p>}
      </Card>
    </>
  );
}
