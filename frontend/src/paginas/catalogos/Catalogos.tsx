/*
 * Pagina "Catalogos de personal" (/catalogos): departamentos, puestos y
 * profesiones. Pide "catalogos.editar". Mismo diseno que pgTipos del
 * prototipo (tabla con Nombre, Descripcion, Estado y Acciones).
 *
 *   - Una pestana por catalogo (?pestana=puestos), con cuantos hay.
 *   - Buscador y filtro Todos / Activos / Inactivos (?estado=activos).
 *   - Columna "Funcionarios": cuantos funcionarios activos lo tienen hoy.
 *   - Acciones de cada fila: Editar e Inactivar/Reactivar (ventanas cortas).
 *   - "Crear ..." abre la ventana; tiene "Guardar y crear otro" para la carga
 *     inicial de la Municipalidad.
 *
 * No se borra nada: se inactiva (ver backend/src/catalogos/catalogos.service.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { consultarCatalogos, type CatalogosCompletos, type ElementoDeCatalogo, type TipoDeCatalogo } from '../../api/catalogos';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { ModalElemento, ModalEstadoDeElemento } from './ModalesDeCatalogo';
import { TEXTOS, TIPOS } from './textos';

type FiltroDeEstado = '' | 'activos' | 'inactivos';

const FILTROS: { valor: FiltroDeEstado; texto: string }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'activos', texto: 'Activos' },
  { valor: 'inactivos', texto: 'Inactivos' },
];

type Ventana =
  | { tipo: 'crear' }
  | { tipo: 'editar'; elemento: ElementoDeCatalogo }
  | { tipo: 'estado'; elemento: ElementoDeCatalogo }
  | null;

export function Catalogos() {
  const [parametros, cambiar] = useParametrosEnUrl();
  const pedida = parametros.get('pestana') as TipoDeCatalogo | null;
  const pestana: TipoDeCatalogo = pedida && TIPOS.includes(pedida) ? pedida : 'departamentos';
  const estado = (parametros.get('estado') ?? '') as FiltroDeEstado;
  const t = TEXTOS[pestana];

  const [datos, setDatos] = useState<CatalogosCompletos | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>(null);
  /** Fila recien creada o editada (se resalta un momento). */
  const [resaltada, setResaltada] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await consultarCatalogos());
    } catch (e) {
      setError(textoDelError(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);


  function alGuardar(texto: string, id?: string) {
    setVentana(null);
    setAviso(texto);
    mostrar(id);
    void cargar();
  }

  /**
   * Resalta la fila recien guardada y quita la busqueda y el filtro, para
   * que no quede escondida (p. ej. crear uno activo con el filtro "Inactivos").
   */
  function mostrar(id?: string) {
    setResaltada(id ?? null);
    setBusqueda('');
    if (estado) cambiar({ estado: '' });
  }

  const texto = busqueda.trim().toLowerCase();
  const lista = (datos?.[pestana] ?? []).filter(
    (e) =>
      (estado === '' || (estado === 'activos') === e.activo) &&
      (!texto || e.nombre.toLowerCase().includes(texto) || (e.descripcion ?? '').toLowerCase().includes(texto)),
  );

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Catálogos de personal</h1>
          <p>
            Departamentos, puestos y profesiones que se eligen al registrar a un funcionario. No se borran: se inactivan,
            para no romper el expediente ni el historial.
          </p>
        </div>
        <div className="acc">
          <BotonConAyuda
            clase="btn btn-primario"
            icono="mas"
            texto={`Crear ${t.singular}`}
            ayuda={`Agregar ${t.un} ${t.singular} al catálogo`}
            alHacerClic={() => setVentana({ tipo: 'crear' })}
          />
        </div>
      </div>

      <Pestanas
        prefijo="cat"
        etiqueta="Catálogos"
        actual={pestana}
        alCambiar={(id) => {
          setAviso(null);
          setBusqueda('');
          cambiar({ pestana: id === 'departamentos' ? '' : id });
        }}
        opciones={TIPOS.map((tipo) => ({ id: tipo, texto: TEXTOS[tipo].titulo, cuenta: datos?.[tipo].length }))}
      />

      <PanelDePestana id={pestana} actual={pestana} prefijo="cat">
        <p className="nota-pagina">{t.explicacion}</p>

        <div className="herramientas">
          <div className="buscador">
            <Icono nombre="buscar" />
            <input
              type="search"
              placeholder="Buscar por nombre o descripción"
              aria-label={`Buscar en ${t.titulo.toLowerCase()}`}
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
            {datos[pestana].length === 0 ? (
              <>
                <h3>Todavía no hay {t.titulo.toLowerCase()}</h3>
                <p>
                  Cree {t.el === 'la' ? 'la primera' : 'el primero'} con el botón «Crear {t.singular}». Puede usar «Guardar y crear
                  otr{t.o}» para cargar varios seguidos.
                </p>
              </>
            ) : (
              <>
                <h3>No hay {t.titulo.toLowerCase()} que coincidan</h3>
                <p>Pruebe con otra búsqueda o quite el filtro de estado.</p>
              </>
            )}
          </div>
        )}

        {datos && lista.length > 0 && (
          <div className="tabla-envoltura tabla-alta">
            <table>
              <caption className="solo-lector">
                {t.titulo}. Las acciones están en la última columna.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Descripción</th>
                  <th scope="col" className="num">
                    Funcionarios
                  </th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="acciones">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id} data-resaltada={e.id === resaltada ? 'si' : undefined}>
                    <td data-etiqueta="Nombre">
                      <b>{e.nombre}</b>
                    </td>
                    <td data-etiqueta="Descripción">{e.descripcion ?? <span className="sec-dato">Sin descripción</span>}</td>
                    <td data-etiqueta="Funcionarios" className="num">
                      <span aria-label={`${e.cantidadFuncionarios} funcionarios activos`}>{e.cantidadFuncionarios}</span>
                    </td>
                    <td data-etiqueta="Estado">
                      {e.activo ? <span className="chip chip-exito">Activ{t.o}</span> : <span className="chip chip-advert">Inactiv{t.o}</span>}
                    </td>
                    <td className="acciones">
                      <BotonIcono icono="editar" texto={`Editar ${t.singular}`} sobre={e.nombre} alHacerClic={() => setVentana({ tipo: 'editar', elemento: e })} />
                      {e.activo ? (
                        <BotonIcono
                          icono="desactivar"
                          peligro
                          texto={`Inactivar ${t.singular} (deja de poder elegirse)`}
                          sobre={e.nombre}
                          alHacerClic={() => setVentana({ tipo: 'estado', elemento: e })}
                        />
                      ) : (
                        <BotonIcono
                          icono="reactivar"
                          texto={`Reactivar ${t.singular}`}
                          sobre={e.nombre}
                          alHacerClic={() => setVentana({ tipo: 'estado', elemento: e })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelDePestana>

      {/* ---------------- Ventanas ---------------- */}
      {(ventana?.tipo === 'crear' || ventana?.tipo === 'editar') && (
        <ModalElemento
          tipo={pestana}
          elemento={ventana.tipo === 'editar' ? ventana.elemento : undefined}
          alCerrar={() => setVentana(null)}
          alGuardar={(guardado, sigueAbierta) => {
            const accion = ventana.tipo === 'crear' ? `Se creó ${t.el} ${t.singular}` : `Se guardaron los cambios de`;
            if (sigueAbierta) {
              mostrar(guardado.id);
              setAviso(null);
              void cargar();
            } else alGuardar(`${accion} «${guardado.nombre}».`, guardado.id);
          }}
        />
      )}
      {ventana?.tipo === 'estado' && (
        <ModalEstadoDeElemento tipo={pestana} elemento={ventana.elemento} alCerrar={() => setVentana(null)} alGuardar={(aviso) => alGuardar(aviso, ventana.elemento.id)} />
      )}
    </section>
  );
}
