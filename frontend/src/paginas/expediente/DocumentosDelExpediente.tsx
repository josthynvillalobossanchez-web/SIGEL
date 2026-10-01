/*
 * Pestana "Documentos" del expediente (Ficha 18 y gestion documental).
 *
 *   - Lista paginada de los documentos de la persona, con buscador, filtro
 *     por tipo y (solo Recursos Humanos) filtro Vigentes / Dados de baja.
 *   - Ver = ventana con visor (PDF o imagen); Descargar; Editar titulo o
 *     tipo; Dar de baja y Restaurar. Nada se borra.
 *   - Quien puede cada cosa lo decide el backend (documento.acciones): la
 *     persona edita y da de baja lo que ELLA subio; Recursos Humanos, todo;
 *     los que genera SINERGIA solo se ven. Cuando no se puede, el boton
 *     queda atenuado y su globo de ayuda explica por que.
 *   - "Subir documento" (en la tarjeta del expediente) abre una pagina por pasos.
 *
 * Los filtros viven en la URL (?busqueda=&tipo=&estado=&pagina=).
 */
import { useState } from 'react';
import { consultarDocumentos, consultarTiposDeDocumento, type DocumentoDeLista, type EstadoDeDocumentos } from '../../api/documentos';
import { BotonIcono } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { useSesion } from '../../sesion/SesionProveedor';
import { formatearTamano } from '../../utilidades/archivos';
import { formatearFechaSola, formatearFecha } from '../../utilidades/fechas';
import { textoDelError } from '../../api/cliente';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { descargarDocumento } from './descargar';
import { ModalBajaDeDocumento, ModalEditarDocumento, ModalRestaurarDocumento } from './ModalesDeDocumento';
import { VisorDeDocumento } from './VisorDeDocumento';

type Ventana =
  | { tipo: 'ver' | 'editar' | 'baja' | 'restaurar'; documento: DocumentoDeLista }
  | null;

const FILTROS_DE_ESTADO: { valor: EstadoDeDocumentos; texto: string }[] = [
  { valor: 'vigentes', texto: 'Vigentes' },
  { valor: 'bajas', texto: 'Dados de baja' },
  { valor: 'todos', texto: 'Todos' },
];

export function DocumentosDelExpediente({ funcionarioId, propio }: { funcionarioId: string; propio: boolean }) {
  const { tienePermisos } = useSesion();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const busquedaEnUrl = parametros.get('busqueda') ?? '';
  const tipoId = parametros.get('tipo') ?? '';
  const puedeVerBajas = tienePermisos('documentos.restaurar');
  const pedido = parametros.get('estado');
  // Quien no puede ver bajas siempre ve solo los vigentes (el backend tambien lo fuerza).
  const estado: EstadoDeDocumentos = puedeVerBajas && (pedido === 'bajas' || pedido === 'todos') ? pedido : 'vigentes';
  const puedeAbrir = tienePermisos('documentos.descargar');

  const [texto, setTexto] = useBusquedaDiferida(busquedaEnUrl, (b) => cambiar({ busqueda: b }));
  const [ventana, setVentana] = useState<Ventana>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorDeDescarga, setErrorDeDescarga] = useState<string | null>(null);

  const { datos: tipos } = useConsulta(() => consultarTiposDeDocumento(), []);
  const { datos: lista, error, cargando, recargar } = useConsulta(
    () => consultarDocumentos(funcionarioId, { pagina, busqueda: busquedaEnUrl, tipoDocumentoId: tipoId, estado }),
    [funcionarioId, pagina, busquedaEnUrl, tipoId, estado],
  );

  const sinFiltros = !busquedaEnUrl && !tipoId && estado === 'vigentes';
  const bloqueoDeVer = puedeAbrir ? null : 'su rol no permite abrir documentos.';

  function alTerminar(texto: string) {
    setVentana(null);
    setAviso(texto);
    recargar();
  }

  async function bajar(d: DocumentoDeLista) {
    setAviso(null);
    setErrorDeDescarga(null);
    try {
      await descargarDocumento(d);
    } catch (e) {
      setErrorDeDescarga(textoDelError(e));
    }
  }

  return (
    <>
      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input
            type="search"
            placeholder="Buscar por título o nombre del archivo"
            aria-label="Buscar documentos"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={120}
          />
        </div>
        <label className="filtro-select">
          <span className="solo-lector">Filtrar por tipo de documento</span>
          <select value={tipoId} onChange={(e) => cambiar({ tipo: e.target.value })} data-ayuda="Filtrar por tipo de documento">
            <option value="">Todos los tipos</option>
            {(tipos ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        {puedeVerBajas && (
          <div className="filtros" role="group" aria-label="Filtrar por estado">
            {FILTROS_DE_ESTADO.map((f) => (
              <button
                key={f.valor}
                type="button"
                className="filtro"
                aria-pressed={estado === f.valor}
                data-ayuda={`Mostrar ${f.texto.toLowerCase()}`}
                onClick={() => cambiar({ estado: f.valor === 'vigentes' ? '' : f.valor })}
              >
                {f.texto}
              </button>
            ))}
          </div>
        )}
      </div>

      <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>
      {errorDeDescarga && <Mensaje tipo="error">{errorDeDescarga}</Mensaje>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {cargando && !lista && <p style={{ color: 'var(--texto-sec)' }}>Cargando los documentos…</p>}

      {lista && lista.datos.length === 0 && (
        <div className="vacio">
          <Icono nombre="carpeta" tamano={36} />
          {sinFiltros ? (
            <>
              <h3>Todavía no hay documentos</h3>
              <p>
                {propio ? 'Puede subir sus documentos' : 'Se pueden subir documentos'} con el botón «Subir documento». Se guardan cifrados: solo se abren aquí,
                con permiso y dejando registro.
              </p>
            </>
          ) : (
            <>
              <h3>No hay documentos que coincidan</h3>
              <p>Pruebe con otra búsqueda o quite los filtros.</p>
            </>
          )}
        </div>
      )}

      {lista && lista.datos.length > 0 && (
        <div className="tabla-envoltura tabla-alta">
          <table>
            <caption className="solo-lector">Documentos del expediente. Las acciones están en la última columna.</caption>
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col">Tipo</th>
                <th scope="col">Archivo</th>
                <th scope="col">Fecha</th>
                <th scope="col">Subido por</th>
                <th scope="col" className="acciones">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.datos.map((d) => (
                <tr key={d.id} className={d.vigente ? undefined : 'fila-baja'}>
                  <td data-etiqueta="Documento">
                    <b>{d.titulo}</b>
                    {!d.vigente && (
                      <>
                        {' '}
                        <span className="chip chip-advert">Dado de baja</span>
                      </>
                    )}
                    {d.descripcion && <div className="sec-dato">{d.descripcion}</div>}
                    {d.baja && (
                      <div className="sec-dato">
                        Baja{d.baja.fecha ? ` el ${formatearFecha(d.baja.fecha)}` : ''}
                        {d.baja.quien ? ` por ${d.baja.quien}` : ''}
                        {d.baja.motivo ? `: ${d.baja.motivo}` : ''}
                      </div>
                    )}
                  </td>
                  <td data-etiqueta="Tipo">{d.tipo.nombre}</td>
                  <td data-etiqueta="Archivo">
                    <span className="chip chip-neutro">{d.formato.toUpperCase()}</span> <span className="num">{formatearTamano(d.tamanoBytes)}</span>
                  </td>
                  <td data-etiqueta="Fecha" className="num">
                    {d.fechaDocumento ? formatearFechaSola(d.fechaDocumento) : <span className="sec-dato">Sin fecha</span>}
                    <div className="sec-dato">Subido el {formatearFecha(d.fechaRegistro)}</div>
                  </td>
                  <td data-etiqueta="Subido por">
                    {d.generadoPorSistema ? (
                      <span className="chip chip-info">Generado por SINERGIA</span>
                    ) : d.subidoPorElFuncionario ? (
                      'La propia persona'
                    ) : (
                      (d.subidoPor ?? '—')
                    )}
                  </td>
                  <td className="acciones">
                    <BotonIcono icono="ojo" texto="Ver documento" sobre={d.titulo} bloqueadoPor={bloqueoDeVer} alHacerClic={() => setVentana({ tipo: 'ver', documento: d })} />
                    <BotonIcono icono="descargar" texto="Descargar documento" sobre={d.titulo} bloqueadoPor={bloqueoDeVer} alHacerClic={() => void bajar(d)} />
                    <BotonIcono
                      icono="editar"
                      texto="Editar título o tipo"
                      sobre={d.titulo}
                      bloqueadoPor={d.acciones.motivoSinEditar}
                      alHacerClic={() => setVentana({ tipo: 'editar', documento: d })}
                    />
                    {d.vigente ? (
                      <BotonIcono
                        icono="desactivar"
                        peligro
                        texto="Dar de baja (se conserva y se puede restaurar)"
                        sobre={d.titulo}
                        bloqueadoPor={d.acciones.motivoSinBaja}
                        alHacerClic={() => setVentana({ tipo: 'baja', documento: d })}
                      />
                    ) : (
                      <BotonIcono
                        icono="reactivar"
                        texto="Restaurar documento"
                        sobre={d.titulo}
                        bloqueadoPor={d.acciones.motivoSinRestaurar}
                        alHacerClic={() => setVentana({ tipo: 'restaurar', documento: d })}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista && lista.total > 0 && (
        <Paginacion resultado={lista} nombre={['documento', 'documentos']} alCambiar={(n) => cambiar({ pagina: String(n) })} />
      )}

      {ventana?.tipo === 'ver' && <VisorDeDocumento documento={ventana.documento} alCerrar={() => setVentana(null)} />}
      {ventana?.tipo === 'editar' && (
        <ModalEditarDocumento documento={ventana.documento} tipos={tipos ?? []} alCerrar={() => setVentana(null)} alGuardar={alTerminar} />
      )}
      {ventana?.tipo === 'baja' && (
        <ModalBajaDeDocumento documento={ventana.documento} esPropio={propio} alCerrar={() => setVentana(null)} alGuardar={alTerminar} />
      )}
      {ventana?.tipo === 'restaurar' && <ModalRestaurarDocumento documento={ventana.documento} alCerrar={() => setVentana(null)} alGuardar={alTerminar} />}
    </>
  );
}
