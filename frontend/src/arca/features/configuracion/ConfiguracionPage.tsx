import { useSearchParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { CajasSection } from './CajasSection';
import styles from './Configuracion.module.css';
import { MunicipalSection, PrintSection } from './RecibosSections';
import { TarifasSection } from './TarifasSection';

const SECTIONS = [
  { key: 'tarifas', label: 'Tarifas' },
  { key: 'municipal', label: 'Datos municipales' },
  { key: 'impresion', label: 'Impresión' },
  { key: 'cajas', label: 'Cajas' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/** Panel de configuración (solo Administrador): tarifas, datos del recibo, impresión y cajas. */
export function ConfiguracionPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('seccion');
  const current: SectionKey = SECTIONS.some((s) => s.key === requested) ? (requested as SectionKey) : 'tarifas';

  return (
    <>
      <PageHeader title="Configuración" subtitle="Tarifas, datos del recibo, impresión y cajas. Los cambios quedan en la bitácora." />
      <div className={styles.nav} role="group" aria-label="Secciones de configuración">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" aria-pressed={current === s.key} onClick={() => setParams({ seccion: s.key }, { replace: true })}>
            {s.label}
          </button>
        ))}
      </div>
      {current === 'tarifas' && <TarifasSection />}
      {current === 'municipal' && <MunicipalSection />}
      {current === 'impresion' && <PrintSection />}
      {current === 'cajas' && <CajasSection />}
    </>
  );
}
