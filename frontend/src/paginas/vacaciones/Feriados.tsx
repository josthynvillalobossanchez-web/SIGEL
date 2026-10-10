/*
 * Feriados (/calendario/feriados), para Recursos Humanos.
 *
 * Es un CATALOGO (decision de Josthyn, 01/10): cada feriado se digita una
 * sola vez y el sistema lo repite solo cada anio. Tres formas:
 *   - Cada anio el mismo dia (15 de setiembre, 25 de diciembre...).
 *   - Semana Santa (Jueves o Viernes Santo): cambian cada anio y el sistema
 *     los calcula con la fecha de la Pascua.
 *   - Solo una vez: un asueto o el traslado de un feriado en un anio dado.
 * "Cargar feriados de ley" llena el catalogo con los de Costa Rica de un clic.
 * Un feriado desactivado deja de descontarse sin borrarlo. Cambiarlos no
 * altera solicitudes ya hechas (cada una guardo sus dias habiles).
 */
import { useState } from 'react';
import {
  cargarFeriadosDeLey,
  consultarCatalogoDeFeriados,
  crearFeriado,
  editarFeriado,
  eliminarFeriado,
  type DatosDeFeriado,
  type DiaNoLaborable,
  type ReglaDeFeriado,
} from '../../api/vacaciones';
import { textoDelError } from '../../api/cliente';
import { CampoFecha } from '../../componentes/CampoFecha';
import { BotonIcono } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { Texto } from '../../componentes/CamposDeFormulario';
import { fechaLargaConAnio, hoyEnCostaRica, nombreCortoDelMes, nombreDelMes } from '../../utilidades/calendario';
import { useConsulta } from '../../utilidades/useConsulta';

type Ventana = { tipo: 'nuevo' } | { tipo: 'editar'; dia: DiaNoLaborable } | { tipo: 'quitar'; dia: DiaNoLaborable } | null;

/** "15 de setiembre", "Jueves Santo" o "14 de octubre de 2026". */
function cuandoCae(d: DiaNoLaborable): string {
  if (d.regla === 'fija') return `${d.dia} de ${nombreDelMes((d.mes ?? 1) - 1)}`;
  if (d.regla === 'juevesSanto') return 'Jueves Santo';
  if (d.regla === 'viernesSanto') return 'Viernes Santo';
  return d.fecha ? fechaLargaConAnio(d.fecha, '0000-01-01') : '';
}

export function Feriados() {
  const lista = useConsulta(consultarCatalogoDeFeriados, []);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const hoy = hoyEnCostaRica();

  const todos = lista.datos ?? [];
  const cadaAnio = todos.filter((d) => d.regla !== 'unica');
  const unaVez = todos.filter((d) => d.regla === 'unica');

  async function deLey() {
    setCargando(true);
    setError(null);
    try {
      const creados = await cargarFeriadosDeLey();
      setAviso(creados.length ? `Se agregaron ${creados.length} feriados de ley. Desactive los que la Municipalidad no dé libres.` : 'Los feriados de ley ya estaban todos en el catálogo.');
      lista.recargar();
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setCargando(false);
    }
  }

  async function alternar(dia: DiaNoLaborable) {
    setError(null);
    try {
      await editarFeriado(dia.id, { activo: !dia.activo });
      lista.recargar();
    } catch (e) {
      setError(textoDelError(e));
    }
  }

  function fila(d: DiaNoLaborable) {
    const paso = d.regla === 'unica' && !d.proxima;
    const cuando = d.proxima ?? d.fecha;
    return (
      <li key={d.id} data-activo={d.activo && !paso ? 'si' : 'no'}>
        <span className="feriado-fecha" data-regla={d.regla}>
          {cuando ? (
            <>
              <b>{Number(cuando.slice(8))}</b>
              <small>{nombreCortoDelMes(Number(cuando.slice(5, 7)) - 1)}</small>
            </>
          ) : (
            <Icono nombre="bandera" />
          )}
        </span>
        <span className="feriado-texto">
          <b>{d.nombre}</b>
          <small>
            {d.regla === 'unica' ? 'Solo una vez · ' : 'Cada año · '}
            {cuandoCae(d)}
            {d.regla !== 'unica' && d.proxima && ` · próximo: ${fechaLargaConAnio(d.proxima, hoy)}`}
            {d.regla === 'juevesSanto' || d.regla === 'viernesSanto' ? ' (se calcula con la Pascua)' : ''}
            {paso ? ' · ya pasó' : ''}
            {!d.activo ? ' · desactivado (no se descuenta)' : ''}
          </small>
        </span>
        <span className="feriado-acciones">
          <BotonIcono icono="editar" texto="Editar" sobre={d.nombre} alHacerClic={() => setVentana({ tipo: 'editar', dia: d })} />
          <BotonIcono icono={d.activo ? 'ojoTachado' : 'ojo'} texto={d.activo ? 'Desactivar (deja de descontarse)' : 'Activar'} sobre={d.nombre} alHacerClic={() => void alternar(d)} />
          <BotonIcono icono="basura" texto="Quitar" sobre={d.nombre} peligro alHacerClic={() => setVentana({ tipo: 'quitar', dia: d })} />
        </span>
      </li>
    );
  }

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Feriados</h1>
          <p>Se digitan una sola vez y se repiten solos cada año. El sistema los descuenta al contar los días hábiles de las vacaciones y los muestra en el calendario.</p>
        </div>
        <div className="acc">
          <button type="button" className="btn btn-secundario" onClick={() => void deLey()} disabled={cargando} aria-busy={cargando} data-ayuda="Agregar de un clic los feriados de ley de Costa Rica que falten (no duplica los que ya están)">
            <Icono nombre="bandera" /> Cargar feriados de ley
          </button>
          <button type="button" className="btn btn-primario" onClick={() => setVentana({ tipo: 'nuevo' })} data-ayuda="Agregar un feriado o un asueto">
            <Icono nombre="mas" /> Agregar feriado
          </button>
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      {(error || lista.error) && <Mensaje tipo="error">{error ?? lista.error}</Mensaje>}

      {lista.datos && todos.length === 0 && (
        <div className="vacio">
          <Icono nombre="bandera" tamano={30} />
          <h3>Todavía no hay feriados</h3>
          <p>Use «Cargar feriados de ley» para tener los de Costa Rica de una vez, o agréguelos uno por uno. Solo se hace una vez: se repiten solos cada año.</p>
        </div>
      )}

      {cadaAnio.length > 0 && (
        <>
          <h2 className="inicio-titulo">Cada año ({cadaAnio.length})</h2>
          <ul className="lista-feriados">{cadaAnio.map(fila)}</ul>
        </>
      )}
      {unaVez.length > 0 && (
        <>
          <h2 className="inicio-titulo">Solo una vez ({unaVez.length})</h2>
          <ul className="lista-feriados">{unaVez.map(fila)}</ul>
        </>
      )}

      {ventana && ventana.tipo !== 'quitar' && (
        <ModalFeriado
          dia={ventana.tipo === 'editar' ? ventana.dia : null}
          alCerrar={() => setVentana(null)}
          alGuardar={(texto) => {
            setVentana(null);
            setAviso(texto);
            lista.recargar();
          }}
        />
      )}
      {ventana?.tipo === 'quitar' && (
        <ModalQuitar
          dia={ventana.dia}
          alCerrar={() => setVentana(null)}
          alQuitar={() => {
            setVentana(null);
            setAviso('Feriado quitado.');
            lista.recargar();
          }}
        />
      )}
    </section>
  );
}

const FORMAS: { valor: 'fija' | 'semanaSanta' | 'unica'; texto: string; ayuda: string }[] = [
  { valor: 'fija', texto: 'Cada año', ayuda: 'Cae siempre el mismo día y mes' },
  { valor: 'semanaSanta', texto: 'Semana Santa', ayuda: 'Jueves o Viernes Santo: el sistema calcula la fecha cada año' },
  { valor: 'unica', texto: 'Solo una vez', ayuda: 'Un asueto o el traslado de un feriado en un año' },
];

function ModalFeriado({ dia, alCerrar, alGuardar }: { dia: DiaNoLaborable | null; alCerrar: () => void; alGuardar: (mensaje: string) => void }) {
  const [nombre, setNombre] = useState(dia?.nombre ?? '');
  const [forma, setForma] = useState<'fija' | 'semanaSanta' | 'unica'>(dia?.regla === 'unica' ? 'unica' : dia && dia.regla !== 'fija' ? 'semanaSanta' : 'fija');
  const [mes, setMes] = useState(String(dia?.mes ?? ''));
  const [diaDelMes, setDiaDelMes] = useState(String(dia?.dia ?? ''));
  const [cualSanto, setCualSanto] = useState<ReglaDeFeriado>(dia?.regla === 'juevesSanto' ? 'juevesSanto' : 'viernesSanto');
  const [fecha, setFecha] = useState(dia?.fecha ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maximo = mes ? new Date(Date.UTC(2000, Number(mes), 0)).getUTCDate() : 31;
  const completo =
    nombre.trim().length >= 2 &&
    (forma === 'fija' ? Boolean(mes) && Number(diaDelMes) >= 1 && Number(diaDelMes) <= maximo : forma === 'unica' ? /^\d{4}-\d{2}-\d{2}$/.test(fecha) : true);

  async function guardar() {
    const regla: ReglaDeFeriado = forma === 'semanaSanta' ? cualSanto : forma;
    const datos: DatosDeFeriado = {
      nombre: nombre.trim(),
      regla,
      ...(regla === 'fija' ? { mes: Number(mes), dia: Number(diaDelMes) } : {}),
      ...(regla === 'unica' ? { fecha } : {}),
    };
    setOcupado(true);
    setError(null);
    try {
      if (dia) {
        await editarFeriado(dia.id, datos);
        alGuardar('Feriado actualizado.');
      } else {
        await crearFeriado(datos);
        alGuardar(regla === 'unica' ? 'Día agregado.' : 'Feriado agregado: se repetirá solo cada año.');
      }
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal titulo={dia ? 'Editar feriado' : 'Agregar feriado'} icono="bandera" alCerrar={alCerrar} alEnviar={() => void guardar()} ocupado={ocupado} confirmarDesactivado={!completo}>
      <Texto id="feriado-nombre" etiqueta="Nombre" valor={nombre} alCambiar={setNombre} obligatorio max={120} placeholder="Ej.: Anexión del Partido de Nicoya" />
      <div className="campo">
        <span className="etiqueta-campo">¿Cuándo cae?</span>
        <div className="segmentado" role="group" aria-label="Cómo se repite">
          {FORMAS.map((f) => (
            <button key={f.valor} type="button" aria-pressed={forma === f.valor} onClick={() => setForma(f.valor)} data-ayuda={f.ayuda}>
              {f.texto}
            </button>
          ))}
        </div>
      </div>
      {forma === 'fija' && (
        <div className="fechas-escritas">
          <div className="campo">
            <label htmlFor="feriado-dia">
              Día <span className="obligatorio">*</span>
            </label>
            <input id="feriado-dia" type="number" min={1} max={maximo} value={diaDelMes} onChange={(e) => setDiaDelMes(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="feriado-mes">
              Mes <span className="obligatorio">*</span>
            </label>
            <select id="feriado-mes" value={mes} onChange={(e) => setMes(e.target.value)}>
              <option value="">Seleccione…</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {nombreDelMes(i)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {forma === 'semanaSanta' && (
        <div className="campo">
          <label htmlFor="feriado-santo">Día</label>
          <select id="feriado-santo" value={cualSanto} onChange={(e) => setCualSanto(e.target.value as ReglaDeFeriado)}>
            <option value="juevesSanto">Jueves Santo</option>
            <option value="viernesSanto">Viernes Santo</option>
          </select>
          <span className="ayuda">Cambia de fecha cada año: el sistema la calcula con la Pascua.</span>
        </div>
      )}
      {forma === 'unica' && <CampoFecha id="feriado-fecha" etiqueta="Fecha" valor={fecha} alCambiar={setFecha} obligatorio />}
      <p className="ayuda-detalle">
        {forma === 'unica'
          ? 'Solo ese día (por ejemplo, un asueto o el traslado de un feriado ese año).'
          : 'Se repite solo todos los años: no hay que volver a agregarlo.'}
      </p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}

function ModalQuitar({ dia, alCerrar, alQuitar }: { dia: DiaNoLaborable; alCerrar: () => void; alQuitar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function quitar() {
    setOcupado(true);
    try {
      await eliminarFeriado(dia.id);
      alQuitar();
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }
  return (
    <Modal titulo="Quitar feriado" icono="basura" alCerrar={alCerrar} alEnviar={() => void quitar()} textoConfirmar="Quitar" peligro ocupado={ocupado}>
      <p>
        ¿Quitar <b>{dia.nombre}</b> ({cuandoCae(dia)})? Las solicitudes que ya se hicieron no cambian. Si solo quiere que deje de descontarse, mejor desactívelo.
      </p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}
