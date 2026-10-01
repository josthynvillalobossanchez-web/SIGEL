/*
 * Pagina "Tipos de documento" (/tipos-documento, Ficha 18 y pgTipos del
 * prototipo). Pide "tiposDocumento.editar". Mismo diseno que Catalogos:
 * tabla con buscador y filtro Todos / Activos / Inactivos, y ventanas
 * cortas para crear, editar e inactivar.
 *
 * Cada tipo elige sus formatos (PDF, JPG, PNG). Los dos que genera
 * SINERGIA (constancia de vacaciones y curriculum) solo cambian de nombre
 * y no se inactivan. No se borra nada: se inactiva.
 */
import { useState } from 'react';
import { consultarTiposDeDocumento, type TipoDeDocumento } from '../../api/documentos';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useConsulta } from '../../utilidades/useConsulta';
import { NOMBRE_DE_FORMATO } from '../../utilidades/archivos';
import { ModalEstadoDeTipo, ModalTipoDeDocumento } from './ModalesDeTipoDeDocumento';

type FiltroDeEstado = '' | 'activos' | 'inactivos';

const FILTROS: { valor: FiltroDeEstado; texto: string }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'activos', texto: 'Activos' },
  { valor: 'inactivos', texto: 'Inactivos' },
];

type Ventana = { tipo: 'crear' } | { tipo: 'editar'; elemento: TipoDeDocumento } | { tipo: 'estado'; elemento: TipoDeDocumento } | null;

export function TiposDeDocumento() {
  const [parametros, cambiar] = useParametrosEnUrl();
  const estado = (parametros.get('estado') ?? '') as FiltroDeEstado;
  const { datos, error, recargar } = useConsulta(() => consultarTiposDeDocumento(), []);
  const [busqueda, setBusqueda] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);

  /** Resalta la fila guardada y quita busqueda y filtro para que no quede escondida. */
  function mostrar(id?: string) {
    setResaltado(id ?? null);
    setBusqueda('');
    if (estado) cambiar({ estado: '' });
  }

  function alGuardar(texto: string, id?: string) {
    setVentana(null);
    setAviso(texto);
    mostrar(id);
    recargar();
  }

  const texto = busqueda.trim().toLowerCase();
  const lista = (datos ?? []).filter(
    (t) =>
      (estado === '' || (estado === 'activos') === t.activo) &&
      (!texto || t.nombre.toLowerCase().includes(texto) || (t.descripcion ?? '').toLowerCase().includes(texto)),
  );

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Tipos de documento</h1>
          <p>
            Los tipos ordenan el expediente y definen qué formatos se aceptan al subir un documento. No se borran: se inactivan, para no
            romper los documentos ya subidos.
          </p>
        </div>
        <div className="acc">
          <BotonConAyuda
            clase="btn btn-primario"
            icono="mas"
            texto="Crear tipo de documento"
            ayuda="Agregar un tipo de documento y elegir sus formatos"
            alHacerClic={() => setVentana({ tipo: 'crear' })}
          />
        </div>
      </div>

      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input
            type="search"
            placeholder="Buscar por nombre o descripción"
            aria-label="Buscar tipos de documento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="filtros" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((filtro) => (
            <button
              key={filtro.texto}
              type="button"
              className="filtro"
              aria-pressed={estado === filtro.valor}
              data-ayuda={filtro.valor ? `Mostrar solo los ${filtro.texto.toLowerCase()}` : 'Mostrar todos'}
              onClick={() => cambiar({ estado: filtro.valor })}
            >
              {filtro.texto}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!datos && !error && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}

      {datos && lista.length === 0 && (
        <div className="vacio">
          <h3>No hay tipos de documento que coincidan</h3>
          <p>Pruebe con otra búsqueda o quite el filtro de estado.</p>
        </div>
      )}

      {datos && lista.length > 0 && (
        <div className="tabla-envoltura tabla-alta">
          <table>
            <caption className="solo-lector">Tipos de documento. Las acciones están en la última columna.</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Descripción</th>
                <th scope="col">Formatos</th>
                <th scope="col" className="num">
                  Documentos
                </th>
                <th scope="col">Estado</th>
                <th scope="col" className="acciones">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id} data-resaltada={t.id === resaltado ? 'si' : undefined}>
                  <td data-etiqueta="Nombre">
                    <b>{t.nombre}</b>
                    {t.generadoPorSistema && (
                      <>
                        {' '}
                        <span className="chip chip-info">Lo genera SINERGIA</span>
                      </>
                    )}
                  </td>
                  <td data-etiqueta="Descripción">{t.descripcion ?? <span className="sec-dato">Sin descripción</span>}</td>
                  <td data-etiqueta="Formatos">
                    {t.formatos.map((f) => (
                      <span className="chip chip-neutro" key={f} style={{ marginRight: 4 }}>
                        {NOMBRE_DE_FORMATO[f]}
                      </span>
                    ))}
                  </td>
                  <td data-etiqueta="Documentos" className="num">
                    <span aria-label={`${t.cantidadDocumentos} documentos vigentes`}>{t.cantidadDocumentos}</span>
                  </td>
                  <td data-etiqueta="Estado">{t.activo ? <span className="chip chip-exito">Activo</span> : <span className="chip chip-advert">Inactivo</span>}</td>
                  <td className="acciones">
                    <BotonIcono
                      icono="editar"
                      texto={t.generadoPorSistema ? 'Editar nombre (lo genera SINERGIA)' : 'Editar tipo de documento'}
                      sobre={t.nombre}
                      alHacerClic={() => setVentana({ tipo: 'editar', elemento: t })}
                    />
                    {t.activo ? (
                      <BotonIcono
                        icono="desactivar"
                        peligro
                        texto="Inactivar tipo (deja de poder elegirse)"
                        sobre={t.nombre}
                        bloqueadoPor={t.generadoPorSistema ? 'lo genera SINERGIA y no se puede inactivar.' : null}
                        alHacerClic={() => setVentana({ tipo: 'estado', elemento: t })}
                      />
                    ) : (
                      <BotonIcono icono="reactivar" texto="Reactivar tipo" sobre={t.nombre} alHacerClic={() => setVentana({ tipo: 'estado', elemento: t })} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(ventana?.tipo === 'crear' || ventana?.tipo === 'editar') && (
        <ModalTipoDeDocumento
          tipo={ventana.tipo === 'editar' ? ventana.elemento : undefined}
          alCerrar={() => setVentana(null)}
          alGuardar={(guardado, sigueAbierta) => {
            if (sigueAbierta) {
              mostrar(guardado.id);
              setAviso(null);
              recargar();
            } else alGuardar(ventana.tipo === 'crear' ? `Se creó el tipo «${guardado.nombre}».` : `Se guardaron los cambios del tipo «${guardado.nombre}».`, guardado.id);
          }}
        />
      )}
      {ventana?.tipo === 'estado' && <ModalEstadoDeTipo tipo={ventana.elemento} alCerrar={() => setVentana(null)} alGuardar={(texto) => alGuardar(texto, ventana.elemento.id)} />}
    </section>
  );
}
