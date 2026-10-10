/*
 * Reglas de vacaciones (/reglas-vacaciones), para RRHH (catalogos.editar).
 * HU 27 CA04: "la regla debe ser parametrizable sin modificar el codigo".
 *
 * Una tarjeta por regimen (general, anterior...) con:
 *   - los tramos: cuantos dias se ganan por periodo segun los anios de
 *     servicio cumplidos al empezar el periodo (0 a 5 anios: 15 dias; 6 en
 *     adelante: 20, por ejemplo). Se editan "hasta" y "dias"; el "desde" de
 *     cada tramo es el "hasta" del anterior + 1, asi nunca quedan huecos;
 *   - el tope de periodos que se pueden acumular (lo que pase se pierde);
 *   - con cuantos dias de anticipacion se avisa que se perderian dias.
 * Los cambios rigen para los proximos aniversarios: lo ya ganado no cambia.
 */
import { useEffect, useMemo, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { consultarReglasDeVacaciones, guardarRegimen, type RegimenDeVacaciones, type TramoDeVacaciones } from '../../api/vacaciones';
import { BotonIcono } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { useConsulta } from '../../utilidades/useConsulta';

interface FilaEditable {
  /** null en la ultima fila: "en adelante". */
  hasta: string;
  dias: string;
}

const NOMBRE_DEL_REGIMEN: Record<string, string> = { general: 'Régimen general', anterior: 'Régimen anterior' };
const nombreDe = (r: RegimenDeVacaciones) => NOMBRE_DEL_REGIMEN[r.nombre] ?? r.nombre;

/** "0 a 5 años: 15 días · 6 años en adelante: 20 días" */
export function resumenDeTramos(tramos: TramoDeVacaciones[]): string {
  return tramos
    .map((t) => `${t.aniosMaximos === null ? `${t.aniosMinimos} ${t.aniosMinimos === 1 ? 'año' : 'años'} en adelante` : `${t.aniosMinimos} a ${t.aniosMaximos} años`}: ${t.diasPorPeriodo} días`)
    .join(' · ');
}

export function ReglasDeVacaciones() {
  const lista = useConsulta(consultarReglasDeVacaciones, []);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Reglas de vacaciones</h1>
          <p>Cuántos días se ganan por año de servicio en cada régimen, cuántos periodos se pueden acumular y cuándo se avisa que se perderían días. Los cambios rigen para los próximos aniversarios: lo ya ganado no cambia.</p>
        </div>
      </div>
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
      {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
      <div className="lista-regimenes">
        {lista.datos?.map((r) => (
          <TarjetaDeRegimen
            key={r.id + resumenDeTramos(r.tramos) + r.periodosMaximosAcumulables + r.diasAvisoAntesDeVencer}
            regimen={r}
            alGuardar={(texto) => {
              setAviso(texto);
              lista.recargar();
            }}
          />
        ))}
      </div>
    </section>
  );
}

function filasDe(r: RegimenDeVacaciones): FilaEditable[] {
  return r.tramos.map((t) => ({ hasta: t.aniosMaximos === null ? '' : String(t.aniosMaximos), dias: String(t.diasPorPeriodo) }));
}

function TarjetaDeRegimen({ regimen, alGuardar }: { regimen: RegimenDeVacaciones; alGuardar: (texto: string) => void }) {
  const [filas, setFilas] = useState<FilaEditable[]>(() => filasDe(regimen));
  const [tope, setTope] = useState(String(regimen.periodosMaximosAcumulables));
  const [aviso, setAvisoDias] = useState(String(regimen.diasAvisoAntesDeVencer));
  const [descripcion, setDescripcion] = useState(regimen.descripcion ?? '');
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [filas, tope, aviso, descripcion]);

  // Tramos que resultan de lo escrito (el "desde" se calcula) y sus problemas.
  const { tramos, problemas } = useMemo(() => {
    const lista: TramoDeVacaciones[] = [];
    const errores: string[] = [];
    let desde = 0;
    filas.forEach((f, i) => {
      const ultima = i === filas.length - 1;
      const dias = Number(f.dias);
      const hasta = ultima ? null : Number(f.hasta);
      if (!Number.isInteger(dias) || dias < 1 || dias > 60) errores.push(`Tramo ${i + 1}: los días deben ser un número entero entre 1 y 60.`);
      if (!ultima && (!Number.isInteger(hasta) || (hasta as number) < desde || (hasta as number) > 60)) errores.push(`Tramo ${i + 1}: "hasta" debe ser un número entero de ${desde} o más.`);
      lista.push({ aniosMinimos: desde, aniosMaximos: hasta, diasPorPeriodo: dias });
      desde = (hasta ?? desde) + 1;
    });
    const t = Number(tope);
    if (!Number.isInteger(t) || t < 1 || t > 5) errores.push('El tope debe ser un número entero entre 1 y 5 periodos.');
    const a = Number(aviso);
    if (!Number.isInteger(a) || a < 0 || a > 365) errores.push('El aviso debe ser un número entero entre 0 y 365 días.');
    return { tramos: lista, problemas: errores };
  }, [filas, tope, aviso]);

  const huboCambios =
    resumenDeTramos(tramos) !== resumenDeTramos(regimen.tramos) ||
    Number(tope) !== regimen.periodosMaximosAcumulables ||
    Number(aviso) !== regimen.diasAvisoAntesDeVencer ||
    descripcion.trim() !== (regimen.descripcion ?? '');

  function cambiar(i: number, campo: keyof FilaEditable, valor: string) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }
  function agregarTramo() {
    // El ultimo tramo deja de ser "en adelante" (dura 5 anios) y se agrega uno nuevo abierto.
    setFilas((fs) => {
      const desdeUltimo = tramos[tramos.length - 1].aniosMinimos;
      const copia = fs.map((f, i) => (i === fs.length - 1 ? { ...f, hasta: String(desdeUltimo + 4) } : f));
      return [...copia, { hasta: '', dias: fs[fs.length - 1].dias }];
    });
  }
  function quitarTramo(i: number) {
    setFilas((fs) => {
      const sin = fs.filter((_, j) => j !== i);
      return sin.map((f, j) => (j === sin.length - 1 ? { ...f, hasta: '' } : f));
    });
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      const r = await guardarRegimen(regimen.id, {
        descripcion: descripcion.trim(),
        periodosMaximosAcumulables: Number(tope),
        diasAvisoAntesDeVencer: Number(aviso),
        tramos,
      });
      setConfirmando(false);
      alGuardar(`Se guardaron las reglas del ${nombreDe(r).toLowerCase()}: ${resumenDeTramos(r.tramos)}.`);
    } catch (e) {
      setError(textoDelError(e));
      setConfirmando(false);
    } finally {
      setOcupado(false);
    }
  }

  const topeEnDias = tramos.length ? Number(tope) * tramos[tramos.length - 1].diasPorPeriodo : 0;

  return (
    <article className="card regimen">
      <header className="regimen-cab">
        <div>
          <h2>{nombreDe(regimen)}</h2>
          <p className="ayuda-detalle">
            {regimen.funcionariosActivos} {regimen.funcionariosActivos === 1 ? 'funcionario activo' : 'funcionarios activos'} · hoy: {resumenDeTramos(regimen.tramos)}
          </p>
        </div>
      </header>

      <div className="campo">
        <label htmlFor={`desc-${regimen.id}`}>
          Descripción <small className="opcional">(opcional)</small>
        </label>
        <input id={`desc-${regimen.id}`} maxLength={255} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>

      <h3 className="regimen-sub">Días por periodo según los años de servicio</h3>
      <div className="tramos" role="table" aria-label={`Tramos del ${nombreDe(regimen).toLowerCase()}`}>
        <div className="tramo tramo-cab" role="row">
          <span role="columnheader">Desde</span>
          <span role="columnheader">Hasta</span>
          <span role="columnheader">Días por año</span>
          <span role="columnheader" className="sr">Acciones</span>
        </div>
        {filas.map((f, i) => {
          const ultima = i === filas.length - 1;
          return (
            <div className="tramo" role="row" key={i}>
              <span role="cell" className="tramo-desde">
                {tramos[i]?.aniosMinimos ?? '—'} {tramos[i]?.aniosMinimos === 1 ? 'año' : 'años'}
              </span>
              <span role="cell">
                {ultima ? (
                  <span className="tramo-abierto">en adelante</span>
                ) : (
                  <input type="number" min={tramos[i]?.aniosMinimos ?? 0} max={60} value={f.hasta} onChange={(e) => cambiar(i, 'hasta', e.target.value)} aria-label={`Tramo ${i + 1}: hasta cuántos años`} />
                )}
              </span>
              <span role="cell">
                <input type="number" min={1} max={60} value={f.dias} onChange={(e) => cambiar(i, 'dias', e.target.value)} aria-label={`Tramo ${i + 1}: días por periodo`} />
              </span>
              <span role="cell" className="tramo-acciones">
                <BotonIcono icono="basura" texto="Quitar este tramo" sobre={`tramo ${i + 1}`} peligro bloqueadoPor={filas.length === 1 ? 'debe quedar al menos un tramo.' : null} alHacerClic={() => quitarTramo(i)} />
              </span>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn-texto" onClick={agregarTramo} disabled={filas.length >= 10} data-ayuda="Partir el último tramo en dos (por ejemplo, para dar más días a partir de cierta antigüedad)">
        <Icono nombre="mas" tamano={14} /> Agregar tramo
      </button>

      <div className="detalles-rejilla regimen-limites">
        <div className="campo">
          <label htmlFor={`tope-${regimen.id}`}>Tope de periodos acumulables</label>
          <input id={`tope-${regimen.id}`} type="number" min={1} max={5} value={tope} onChange={(e) => setTope(e.target.value)} aria-describedby={`tope-ayuda-${regimen.id}`} />
          <span className="ayuda" id={`tope-ayuda-${regimen.id}`}>
            {topeEnDias > 0 ? `Con el último tramo, nadie acumula más de ${topeEnDias} días; lo que pase se pierde.` : 'Lo que pase del tope se pierde.'}
          </span>
        </div>
        <div className="campo">
          <label htmlFor={`aviso-${regimen.id}`}>Avisar con cuántos días de anticipación</label>
          <input id={`aviso-${regimen.id}`} type="number" min={0} max={365} value={aviso} onChange={(e) => setAvisoDias(e.target.value)} />
          <span className="ayuda">Antes del aniversario en que se perderían días.</span>
        </div>
      </div>

      {problemas.length > 0 && huboCambios && (
        <Mensaje tipo="advert">
          {problemas.map((p) => (
            <span key={p} style={{ display: 'block' }}>
              {p}
            </span>
          ))}
        </Mensaje>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      <div className="regimen-acciones">
        <button
          type="button"
          className="btn btn-secundario"
          disabled={!huboCambios || ocupado}
          onClick={() => {
            setFilas(filasDe(regimen));
            setTope(String(regimen.periodosMaximosAcumulables));
            setAvisoDias(String(regimen.diasAvisoAntesDeVencer));
            setDescripcion(regimen.descripcion ?? '');
          }}
          data-ayuda="Volver a las reglas guardadas"
        >
          Descartar cambios
        </button>
        <button
          type="button"
          className="btn btn-primario"
          disabled={!huboCambios || problemas.length > 0 || ocupado}
          onClick={() => setConfirmando(true)}
          data-ayuda={!huboCambios ? 'No hay cambios que guardar' : problemas.length ? 'Corrija lo que se indica arriba' : 'Guardar las reglas (le pedirá confirmar)'}
        >
          Guardar cambios
        </button>
      </div>

      {confirmando && (
        <Modal
          titulo={`¿Guardar las reglas del ${nombreDe(regimen).toLowerCase()}?`}
          icono="alerta"
          alCerrar={() => setConfirmando(false)}
          alEnviar={() => void guardar()}
          textoConfirmar={ocupado ? 'Guardando…' : 'Sí, guardar'}
          ocupado={ocupado}
        >
          <p>
            <b>{resumenDeTramos(tramos)}</b>; tope de {tope} {Number(tope) === 1 ? 'periodo' : 'periodos'}; aviso {aviso} días antes.
          </p>
          <p>
            Afecta a {regimen.funcionariosActivos} {regimen.funcionariosActivos === 1 ? 'persona' : 'personas'} desde su próximo aniversario. Lo que ya ganaron no cambia. El cambio queda en la bitácora.
          </p>
        </Modal>
      )}
    </article>
  );
}
