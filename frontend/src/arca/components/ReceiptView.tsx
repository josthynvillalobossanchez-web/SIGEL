import type { Receipt } from '../api/types';
import { formatDateTime } from '../lib/dates';
import { formatColones } from '../lib/money';
import { PAYMENT_LABEL, VOID_REASON_LABEL } from '../lib/labels';
import styles from './ReceiptView.module.css';

export type ReceiptFormat = 'termico' | 'carta';

const LEGAL = 'Comprobante de pago municipal – No constituye factura electrónica';

/**
 * Recibo imprimible en blanco y negro: tiquete de 80 mm (302 px) u hoja carta (720 px).
 * Los datos municipales (cédula jurídica, teléfono, dirección) vienen del backend, nunca del código.
 * El estado ANULADO lo determina el recibo real; el recibo anulado nunca se borra.
 */
export function ReceiptView({ receipt, format, redStamp }: { receipt: Receipt; format: ReceiptFormat; redStamp?: boolean }) {
  return format === 'termico' ? <Ticket r={receipt} redStamp={redStamp} /> : <Letter r={receipt} redStamp={redStamp} />;
}

function municipalLine(r: Receipt, sep: string) {
  const m = r.municipality;
  return [m.legalId && `Cédula jurídica ${m.legalId}`, m.address, m.phone && `Tel. ${m.phone}`].filter(Boolean).join(sep);
}

function VoidNote({ r }: { r: Receipt }) {
  if (!r.voidInfo) return null;
  return (
    <div className={styles.voidNote}>
      Anulado el {formatDateTime(r.voidInfo.voidedAt)}
      <br />
      Motivo: {VOID_REASON_LABEL[r.voidInfo.reason]} – {r.voidInfo.detail}
      <br />
      Autorizó: {r.voidInfo.authorizedBy.fullName}
    </div>
  );
}

function Ticket({ r, redStamp }: { r: Receipt; redStamp?: boolean }) {
  const voided = r.status === 'ANULADO';
  return (
    <article className={`${styles.ticket} print-area`} aria-label={`Recibo ${r.number}`}>
      {voided && (
        <div className={styles.stampWrap}>
          <span className={`${styles.stampTicket} ${redStamp ? styles.red : ''}`}>ANULADO</span>
        </div>
      )}
      <div className={styles.center}>
        <img src="/arca/logo-negro.svg" alt="Municipalidad de Palmares" className={styles.ticketLogo} />
      </div>
      <div className={styles.ticketMunicipal}>
        {municipalLine(r, '\n')
          .split('\n')
          .map((l) => (
            <div key={l}>{l}</div>
          ))}
        <div>Palmares, Alajuela, Costa Rica</div>
      </div>
      <hr className={styles.dash} />
      <div className={styles.ticketTitle}>RECIBO DE PAGO</div>
      <div className={styles.ticketNumber}>Nº {r.number}</div>
      <hr className={styles.dash} />
      <Row k="Fecha" v={formatDateTime(r.issuedAt)} />
      <Row k="Cajero" v={r.cashier.fullName} />
      <Row k="Caja" v={r.cashbox.code} />
      <div className={styles.client}>
        <b>Cliente</b>
        <br />
        {r.client ? (
          <>
            {r.client.fullName}
            <br />
            Ced. {r.client.idNumber}
          </>
        ) : (
          'Sin identificar'
        )}
      </div>
      <hr className={styles.dash} />
      {r.lines.map((l, i) => (
        <div key={i} className={styles.ticketLine}>
          <div>{l.conceptName}</div>
          <Row k={`${l.quantity} x ${formatColones(l.unitAmount)}`} v={formatColones(l.lineTotal)} />
        </div>
      ))}
      <hr className={styles.dash} />
      <Row k="Subtotal" v={formatColones(r.subtotal)} />
      <Row k="Descuentos" v={`− ${formatColones(r.discounts)}`} />
      <Row k="Recargos" v={formatColones(r.surcharges)} />
      <div className={styles.ticketTotal}>
        <span>TOTAL</span>
        <span>{formatColones(r.total)}</span>
      </div>
      <hr className={styles.dash} />
      {r.payments.map((p) => (
        <Row key={p.method} k={PAYMENT_LABEL[p.method]} v={formatColones(p.amount)} />
      ))}
      <Row k="Vuelto" v={formatColones(r.change)} />
      <hr className={styles.dash} />
      <div className={styles.legalTicket}>{LEGAL}</div>
      <VoidNote r={r} />
      <div className={styles.footTicket}>
        Conserve este comprobante.
        <br />
        Emitido con ARCA
      </div>
    </article>
  );
}

function Letter({ r, redStamp }: { r: Receipt; redStamp?: boolean }) {
  const voided = r.status === 'ANULADO';
  return (
    <article className={`${styles.letter} print-area`} aria-label={`Recibo ${r.number}`}>
      {voided && (
        <div className={styles.stampWrap}>
          <span className={`${styles.stampLetter} ${redStamp ? styles.red : ''}`}>ANULADO</span>
        </div>
      )}
      <div className={styles.letterHead}>
        <img src="/arca/logo-negro.svg" alt="Municipalidad de Palmares" className={styles.letterLogo} />
        <div className={styles.right}>
          <div className={styles.eyebrow}>RECIBO DE PAGO Nº</div>
          <div className={styles.letterNumber}>{r.number}</div>
          <div className={styles.small}>{formatDateTime(r.issuedAt)}</div>
        </div>
      </div>
      <div className={styles.small} style={{ marginTop: 8 }}>
        Municipalidad de Palmares, Alajuela, Costa Rica
        {municipalLine(r, ' · ') && ` · ${municipalLine(r, ' · ')}`}
      </div>
      <div className={styles.parties}>
        <div>
          <div className={styles.eyebrow}>CLIENTE</div>
          {r.client ? (
            <>
              {r.client.fullName}
              <br />
              {r.client.idNumber}
              {r.client.address && (
                <>
                  <br />
                  {r.client.address}
                </>
              )}
            </>
          ) : (
            'Sin identificar'
          )}
        </div>
        <div>
          <div className={styles.eyebrow}>EMITIDO POR</div>
          {r.cashier.fullName}
          <br />
          Caja {r.cashbox.code}
        </div>
      </div>
      <table className={styles.letterTable}>
        <thead>
          <tr>
            <th>DETALLE</th>
            <th className={styles.right}>CANT.</th>
            <th className={styles.right}>MONTO</th>
            <th className={styles.right}>DESC.</th>
            <th className={styles.right}>MORA</th>
            <th className={styles.right}>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.conceptName}</td>
              <td className={styles.right}>{l.quantity}</td>
              <td className={styles.right}>{formatColones(l.unitAmount)}</td>
              <td className={styles.right}>{formatColones(l.discount)}</td>
              <td className={styles.right}>{formatColones(l.surcharge)}</td>
              <td className={`${styles.right} ${styles.strong}`}>{formatColones(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.letterBottom}>
        <div className={styles.grow}>
          <div className={`${styles.eyebrow} ${styles.mb4}`}>FORMA DE PAGO</div>
          {r.payments.map((p) => (
            <Row key={p.method} k={PAYMENT_LABEL[p.method]} v={formatColones(p.amount)} />
          ))}
          <Row k="Vuelto" v={formatColones(r.change)} />
        </div>
        <div className={styles.totals}>
          <Row k="Subtotal" v={formatColones(r.subtotal)} />
          <Row k="Descuentos" v={`− ${formatColones(r.discounts)}`} />
          <Row k="Recargos" v={formatColones(r.surcharges)} />
          <div className={styles.letterTotal}>
            <div className={styles.eyebrow}>TOTAL</div>
            <div className={styles.letterTotalValue}>{formatColones(r.total)}</div>
          </div>
        </div>
      </div>
      <div className={styles.grow} />
      <VoidNote r={r} />
      <div className={styles.signature}>Firma y sello del cajero</div>
      <div className={styles.legalLetter}>{LEGAL}</div>
      <div className={styles.footLetter}>Emitido con ARCA</div>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
