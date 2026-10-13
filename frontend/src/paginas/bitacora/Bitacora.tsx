/*
 * Bitacora de auditoria (/bitacora), Sprint 3 (HU 46). Solo el Super
 * Administrador (permiso bitacora.ver, que nadie mas puede recibir).
 *
 * Lista paginada (20 por pagina) de lo que se hizo en SINERGIA: creaciones,
 * modificaciones, bajas, aprobaciones, y abrir un expediente o ver y
 * descargar un documento (regla T-4: no se registran entradas, salidas ni
 * consultas generales). Filtros: texto, usuario, accion, entidad, fechas y
 * persona afectada. Tocar una fila abre el detalle con el ANTES y el
 * DESPUES. Es de solo lectura: no hay forma de editar ni borrar un registro.
 */
import { useState } from 'react';
import {
  consultarBitacora,
  consultarOpcionesDeBitacora,
  NOMBRE_DE_ACCION,
  nombreDeEntidad,
  type AccionDeBitacora,
  type MovimientoDeBitacora,
} from '../../api/bitacora';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { Paginacion } from '../../componentes/Paginacion';
import { formatearFechaHora } from '../../utilidades/fechas';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';

const quienLoHizo = (m: MovimientoDeBitacora) =>
  m.usuario ? (m.usuario.funcionario ? `${m.usuario.funcionario.nombre} ${m.usuario.funcionario.primerApellido}` : m.usuario.correo) : 'SINERGIA (automático)';
const personaAfectada = (m: MovimientoDeBitacora) =>
  m.funcionarioAfectado ? [m.funcionarioAfectado.nombre, m.funcionarioAfectado.primerApellido, m.funcionarioAfectado.segundoApellido].filter(Boolean).join(' ') : null;

export function Bitacora() {
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const filtros = {
    busqueda: parametros.get('busqueda') ?? '',
    usuarioId: parametros.get('usuario') ?? '',
    accion: parametros.get('accion') ?? '',
    entidad: parametros.get('entidad') ?? '',
    desde: parametros.get('desde') ?? '',
    hasta: parametros.get('hasta') ?? '',
    funcionarioAfectadoId: parametros.get('persona') ?? '',
    registroAfectadoId: parametros.get('registro') ?? '',
  };
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const [texto, setTexto] = useBusquedaDiferida(filtros.busqueda, (t) => cambiar({ busqueda: t }));
  const opciones = useConsulta(consultarOpcionesDeBitacora, []);
  const lista = useConsulta(
    () =>
      consultarBitacora({
        pagina,
        tamano: 20,
        busqueda: filtros.busqueda || undefined,
        usuarioId: filtros.usuarioId || undefined,
        accion: filtros.accion || undefined,
        entidad: filtros.entidad || undefined,
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
        funcionarioAfectadoId: filtros.funcionarioAfectadoId || undefined,
        registroAfectadoId: filtros.registroAfectadoId || undefined,
      }),
    [pagina, ...Object.values(filtros)],
  );
  const [abierto, setAbierto] = useState<MovimientoDeBitacora | null>(null);
  const hayFiltros = Object.values(filtros).some(Boolean);
  // Nombre de la persona o del registro filtrados (para el chip que permite quitarlos).
  const personaFiltrada = filtros.funcionarioAfectadoId ? lista.datos?.datos.find((m) => m.funcionarioAfectado?.id === filtros.funcionarioAfectadoId) : undefined;

  function limpiar() {
    setTexto('');
    cambiar({ busqueda: '', usuario: '', accion: '', entidad: '', desde: '', hasta: '', persona: '', registro: '' });
  }

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Bitácora de auditoría</h1>
          <p>
            Lo que se hizo en SINERGIA: quién, qué, sobre qué y cuándo, con el antes y el después de cada cambio. Es de solo lectura: ningún
            registro se puede editar ni borrar.
          </p>
        </div>
      </div>

      <div className="herramientas filtros-bitacora">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar en la descripción, el correo o la persona" aria-label="Buscar en la bitácora" />
        </div>
        <label className="filtro-select">
          <span className="sr">Usuario</span>
          <select value={filtros.usuarioId} onChange={(e) => cambiar({ usuario: e.target.value })} aria-label="Quién hizo la acción">
            <option value="">Todos los usuarios</option>
            {(opciones.datos?.usuarios ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre ? `${u.nombre} (${u.correo})` : u.correo}
              </option>
            ))}
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Acción</span>
          <select value={filtros.accion} onChange={(e) => cambiar({ accion: e.target.value })} aria-label="Acción">
            <option value="">Todas las acciones</option>
            {(Object.keys(NOMBRE_DE_ACCION) as AccionDeBitacora[]).map((a) => (
              <option key={a} value={a}>
                {NOMBRE_DE_ACCION[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Entidad</span>
          <select value={filtros.entidad} onChange={(e) => cambiar({ entidad: e.target.value })} aria-label="Sobre qué (entidad)">
            <option value="">Todas las entidades</option>
            {(opciones.datos?.entidades ?? []).map((e) => (
              <option key={e} value={e}>
                {nombreDeEntidad(e)}
              </option>
            ))}
          </select>
        </label>
        <label className="filtro-select filtro-fecha">
          <span>Desde</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiar({ desde: e.target.value })} aria-label="Movimientos desde esta fecha" />
        </label>
        <label className="filtro-select filtro-fecha">
          <span>Hasta</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} aria-label="Movimientos hasta esta fecha (incluida)" />
        </label>
        {hayFiltros && (
          <button type="button" className="btn-texto" onClick={limpiar} data-ayuda="Quitar todos los filtros y la búsqueda">
            Limpiar filtros
          </button>
        )}
      </div>

      {(filtros.funcionarioAfectadoId || filtros.registroAfectadoId) && (
        <div className="chips-filtro">
          {filtros.funcionarioAfectadoId && (
            <button type="button" className="chip chip-info" onClick={() => cambiar({ persona: '' })} data-ayuda="Quitar este filtro">
              Persona: {personaFiltrada ? personaAfectada(personaFiltrada) : 'seleccionada'} <Icono nombre="equis" tamano={12} />
            </button>
          )}
          {filtros.registroAfectadoId && (
            <button type="button" className="chip chip-info" onClick={() => cambiar({ registro: '' })} data-ayuda="Quitar este filtro">
              Historia de un registro <Icono nombre="equis" tamano={12} />
            </button>
          )}
        </div>
      )}

      {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
      {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
      {lista.datos && lista.datos.datos.length === 0 && (
        <div className="vacio">
          <Icono nombre="lista" tamano={34} />
          <h3>{hayFiltros ? 'Ningún movimiento coincide con esos filtros' : 'La bitácora está vacía'}</h3>
          <p>{hayFiltros ? 'Pruebe con otro filtro o quítelos.' : 'Aquí aparecerá cada cambio que se haga en SINERGIA.'}</p>
        </div>
      )}

      {lista.datos && lista.datos.datos.length > 0 && (
        <>
          <div className="tabla-envoltura" aria-busy={lista.cargando}>
            <table className="tabla-bitacora">
              <caption className="solo-lector">Movimientos de la bitácora, del más reciente al más antiguo. Toque una fila para ver el detalle.</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Quién</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Sobre qué</th>
                  <th scope="col">Persona afectada</th>
                  <th scope="col">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {lista.datos.datos.map((m) => (
                  <tr
                    key={m.id}
                    data-abrible
                    tabIndex={0}
                    onClick={() => setAbierto(m)}
                    onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && setAbierto(m)}
                    aria-label={`${formatearFechaHora(m.fechaHora)}, ${quienLoHizo(m)}: ${m.descripcion ?? NOMBRE_DE_ACCION[m.accion]}. Presione Enter para ver el detalle.`}
                  >
                    <td data-etiqueta="Fecha y hora" className="celda-fecha">
                      {formatearFechaHora(m.fechaHora)}
                    </td>
                    <td data-etiqueta="Quién">{quienLoHizo(m)}</td>
                    <td data-etiqueta="Acción">
                      <span className={`chip accion-${m.accion}`}>{NOMBRE_DE_ACCION[m.accion] ?? m.accion}</span>
                    </td>
                    <td data-etiqueta="Sobre qué">{nombreDeEntidad(m.entidad)}</td>
                    <td data-etiqueta="Persona afectada">{personaAfectada(m) ?? '—'}</td>
                    <td data-etiqueta="Descripción" className="celda-descripcion">
                      {m.descripcion ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion resultado={lista.datos} nombre={['movimiento', 'movimientos']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
        </>
      )}

      {abierto && (
        <DetalleDeMovimiento
          movimiento={abierto}
          alCerrar={() => setAbierto(null)}
          alFiltrarPersona={(id) => {
            setAbierto(null);
            cambiar({ persona: id });
          }}
          alFiltrarRegistro={(id) => {
            setAbierto(null);
            cambiar({ registro: id });
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** Nombre legible de un dato del antes/despues ("fechaIngreso" -> "Fecha ingreso"). */
const NOMBRE_DE_DATO: Record<string, string> = {
  direccion: 'Dirección',
  telefonoPersonal: 'Teléfono',
  correoPersonal: 'Correo personal',
  correoInstitucional: 'Correo institucional',
  fechaNacimiento: 'Fecha de nacimiento',
  fechaIngreso: 'Fecha de ingreso',
  fechaSalida: 'Fecha de salida',
  tipoNombramiento: 'Nombramiento',
  primerApellido: 'Primer apellido',
  segundoApellido: 'Segundo apellido',
  motivoBaja: 'Motivo de la baja',
  vigente: 'Vigente',
  titulo: 'Título',
  descripcion: 'Descripción',
  estado: 'Estado',
  motivo: 'Motivo',
  dias: 'Días',
  disponible: 'Días disponibles',
};
function nombreDeDato(campo: string): string {
  if (NOMBRE_DE_DATO[campo]) return NOMBRE_DE_DATO[campo];
  const palabras = campo.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

/** Un valor del antes/despues, legible (texto, numero, si/no, lista u objeto). */
function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.map(valorLegible).join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DetalleDeMovimiento({
  movimiento: m,
  alCerrar,
  alFiltrarPersona,
  alFiltrarRegistro,
}: {
  movimiento: MovimientoDeBitacora;
  alCerrar: () => void;
  alFiltrarPersona: (funcionarioId: string) => void;
  alFiltrarRegistro: (registroId: string) => void;
}) {
  const antes = m.datosAnteriores ?? {};
  const despues = m.datosNuevos ?? {};
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  const persona = personaAfectada(m);

  return (
    <Modal
      titulo={`${NOMBRE_DE_ACCION[m.accion] ?? m.accion}: ${nombreDeEntidad(m.entidad)}`}
      descripcion={formatearFechaHora(m.fechaHora)}
      icono="lista"
      alCerrar={alCerrar}
      ancho
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} data-ayuda="Cerrar el detalle">
            Cerrar
          </button>
          <button className="btn btn-secundario" type="button" onClick={() => alFiltrarRegistro(m.registroAfectadoId)} data-ayuda="Ver todo lo que se ha hecho sobre este mismo registro">
            Historia del registro
          </button>
          {m.funcionarioAfectado && (
            <button className="btn btn-secundario" type="button" onClick={() => alFiltrarPersona(m.funcionarioAfectado!.id)} data-ayuda="Ver todo lo que se ha hecho sobre esta persona">
              Todo sobre {m.funcionarioAfectado.nombre}
            </button>
          )}
        </>
      }
    >
      <dl className="detalle-datos detalle-bitacora">
        <div>
          <dt>Quién</dt>
          <dd>
            {quienLoHizo(m)}
            {m.usuario && m.usuario.funcionario && <small> · {m.usuario.correo}</small>}
          </dd>
        </div>
        <div>
          <dt>Qué hizo</dt>
          <dd>{m.descripcion ?? NOMBRE_DE_ACCION[m.accion]}</dd>
        </div>
        <div>
          <dt>Sobre qué</dt>
          <dd>
            {nombreDeEntidad(m.entidad)}
            {persona && m.entidad !== 'usuario' ? ` de ${persona}` : ''}
          </dd>
        </div>
        {/* El codigo interno del registro (su identificador en la base). No dice nada a simple vista,
            pero identifica el registro exacto: "Historia del registro" lo usa para mostrar todo lo
            que se le ha hecho. Se deja al final, discreto, por si TI necesita rastrearlo. */}
        <div className="detalle-codigo">
          <dt>Código interno del registro</dt>
          <dd>
            <small className="codigo-registro" data-ayuda="Identificador único del registro en la base de datos. Use «Historia del registro» para ver todo lo que se le ha hecho.">
              {m.registroAfectadoId}
            </small>
          </dd>
        </div>
        {persona && (
          <div>
            <dt>Persona afectada</dt>
            <dd>{persona}</dd>
          </div>
        )}
        <div>
          <dt>Dirección IP</dt>
          <dd>{m.direccionIp ?? '—'}</dd>
        </div>
      </dl>

      {campos.length > 0 ? (
        <div className="tabla-envoltura antes-despues">
          <table>
            <caption className="solo-lector">Datos antes y después del cambio</caption>
            <thead>
              <tr>
                <th scope="col">Dato</th>
                <th scope="col">Antes</th>
                <th scope="col">Después</th>
              </tr>
            </thead>
            <tbody>
              {campos.map((c) => (
                <tr key={c}>
                  <th scope="row">{nombreDeDato(c)}</th>
                  <td>{valorLegible(antes[c])}</td>
                  <td>{valorLegible(despues[c])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ayuda-detalle">Este movimiento no guarda datos de antes y después (por ejemplo, abrir un expediente o descargar un documento).</p>
      )}
    </Modal>
  );
}
