import { Link, useNavigate } from 'react-router';
import { dashboardApi } from '../../api/endpoints';
import type { PaymentMethod, ReceiptSummary } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { Kbd } from '../../components/Kbd';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import pages from '../../components/pages.module.css';
import { longDay, formatTime } from '../../lib/dates';
import { PAYMENT_LABEL, SHIFT_LABEL } from '../../lib/labels';
import { formatColones } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../store/session';
import styles from './PanelPage.module.css';

const METHOD_ORDER: PaymentMethod[] = ['EFECTIVO', 'TARJETA', 'SINPE_MOVIL', 'TRANSFERENCIA'];

/** Inicio: totales del día, estado de la caja, desglose por método de pago y últimos recibos (datos reales). */
export function PanelPage() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const dash = useAsync(() => dashboardApi.today(), []);
  const d = dash.data;

  const columns: Column<ReceiptSummary>[] = [
    {
      key: 'n',
      header: 'Nº',
      render: (r) => (
        <Link to={`/cobro/recibos/${r.id}`} className={pages.strong}>
          {r.number}
        </Link>
      ),
    },
    { key: 'h', header: 'Hora', render: (r) => formatTime(r.issuedAt) },
    { key: 'c', header: 'Cliente', render: (r) => r.clientName ?? <span className={pages.muted}>Sin identificar</span> },
    { key: 'k', header: 'Concepto', render: (r) => r.concept },
    { key: 't', header: 'Total', align: 'right', render: (r) => formatColones(r.total) },
    { key: 's', header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const methodTotal = d ? d.byMethod.reduce((a, m) => a + m.amount, 0) : 0;
  const byMethod = new Map(d?.byMethod.map((m) => [m.method, m.amount]));

  return (
    <>
      <PageHeader
        title="Panel principal"
        subtitle={`${longDay()}${d ? ` · Turno ${SHIFT_LABEL[d.shift]}` : ''}`}
        actions={
          <Button variant="primary" height={48} icon={<Icon name="plus" size={16} />} onClick={() => navigate('/cobro/recibos/nuevo')}>
            Nuevo recibo
            <Kbd inverse>F1</Kbd>
          </Button>
        }
      />
      {dash.error && <Alert>{dash.error.message}</Alert>}
      {dash.loading && !d && <p role="status">Cargando…</p>}
      {d && (
        <>
          <div className={styles.cards}>
            <Card>
              <div className={styles.cardLabel}>Total cobrado hoy</div>
              <div className={styles.big}>{formatColones(d.totalCollected)}</div>
              {user?.role === 'CAJERO' && <div className={pages.muted}>Solo sus cobros</div>}
            </Card>
            <Card>
              <div className={styles.cardLabel}>Recibos emitidos</div>
              <div className={styles.big}>{d.receiptCount}</div>
            </Card>
            <Card>
              <div className={styles.cardLabel}>Estado de la caja</div>
              <div className={styles.cashState}>
                <span className={d.session ? styles.dotOn : styles.dotOff} aria-hidden="true" />
                {d.session ? 'Caja abierta' : 'Caja cerrada'}
              </div>
              {d.session && (
                <div className={pages.muted}>
                  {d.session.cashboxCode} · desde {formatTime(d.session.openedAt)} · fondo {formatColones(d.session.openingFloat)}
                </div>
              )}
              <Link to="/cobro/caja" className={styles.cashLink}>
                {d.session ? 'Ir a cierre de caja' : 'Abrir caja'}
              </Link>
            </Card>
          </div>

          <div className={styles.lower}>
            <Card title="Por método de pago">
              {methodTotal === 0 ? (
                <EmptyState>Sin cobros hoy.</EmptyState>
              ) : (
                METHOD_ORDER.map((m) => {
                  const amount = byMethod.get(m) ?? 0;
                  return (
                    <div key={m} className={styles.method}>
                      <div className={styles.methodRow}>
                        <span>{PAYMENT_LABEL[m]}</span>
                        <b>{formatColones(amount)}</b>
                      </div>
                      <div className={styles.track} role="img" aria-label={`${PAYMENT_LABEL[m]}: ${Math.round((amount / methodTotal) * 100)} % del total`}>
                        <div className={styles.fill} style={{ width: `${(amount / methodTotal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
            <Card title="Últimos recibos emitidos" aside={<Link to="/cobro/recibos">Ver todos</Link>}>
              <DataTable caption="Últimos recibos emitidos" columns={columns} rows={d.latest} rowKey={(r) => r.id} empty={<EmptyState>Aún no hay recibos hoy.</EmptyState>} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
