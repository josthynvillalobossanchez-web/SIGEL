/*
 * Pagina "Funcionarios" (pgFuncionarios del prototipo). Pide funcionarios.ver.
 *
 * Lista paginada con busqueda (cedula, nombre, apellidos o correo; acepta
 * varias palabras), filtro por estado y por departamento.
 *   - Tocar una fila          -> ventana "Ficha resumida" (solo lectura).
 *   - Acciones de cada fila   -> Ver ficha | Editar (pagina) | Registrar
 *                                salida o Reingreso (ventana) | Expediente.
 *                                Si una accion no se puede, el boton queda
 *                                atenuado y su ayuda dice por que.
 *   - "Registrar funcionario" -> pagina /funcionarios/nuevo, por pasos.
 *
 * Filtros y ficha abierta en la URL (?busqueda=&estado=&departamento=&jefatura=&pagina=&ver=).
 *
 * "Revisar jefatura" (decision del 30/09): si la jefatura de alguien sale de
 * la Municipalidad o deja de ser Aprobadora, esa persona queda marcada y
 * Recursos Humanos ve arriba cuantas son, con el filtro ?jefatura=revisar.
 * No se adivina la jefatura nueva: la asigna RRHH con "Editar funcionario".
 */
import { useState } from 'react';
import { Paginacion } from '../../componentes/Paginacion';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';
import { Link, useNavigate } from 'react-router';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { consultarFuncionarios, type EstadoDeFuncionario, type FuncionarioEnLista } from '../../api/funcionarios';
import { consultarCatalogos } from '../../api/catalogos';
import { direccionDeFoto } from '../../api/documentos';
import { FotoOIniciales } from '../../componentes/TarjetaDePerfil';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { useSesion } from '../../sesion/SesionProveedor';
import { inicialesDeFuncionario, nombreCompleto } from '../../utilidades/texto';
import { ChipDeFuncionario } from './ChipDeFuncionario';
import { ChipRevisarJefatura, ModalFicha, ModalReingreso, ModalSalida, personasACargo } from './ModalesDeFuncionario';
import { motivoParaEditar, motivoParaExpediente, motivoParaSalida } from './motivos';

const TAMANO_DE_PAGINA = 20;

const FILTROS: { valor: EstadoDeFuncionario | ''; texto: string }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'activo', texto: 'Activos' },
  { valor: 'inactivo', texto: 'Inactivos' },
];

type Ventana =
  | { tipo: 'salida'; f: FuncionarioEnLista }
  | { tipo: 'reingreso'; f: FuncionarioEnLista }
  | null;

export function ListaDeFuncionarios() {
  const { tienePermisos } = useSesion();
  const navegar = useNavigate();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true, salvo: ['ver'] });
  const busquedaEnUrl = parametros.get('busqueda') ?? '';
  const estado = (parametros.get('estado') ?? '') as EstadoDeFuncionario | '';
  const departamentoId = parametros.get('departamento') ?? '';
  const soloRevisar = parametros.get('jefatura') === 'revisar';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const verId = parametros.get('ver');

  const [textoBuscado, setTextoBuscado] = useBusquedaDiferida(busquedaEnUrl, (busqueda) => cambiar({ busqueda }));
  const [aviso, setAviso] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>(null);

  // Departamentos para el filtro (si fallan, el filtro queda vacio y la lista sigue).
  const departamentos = useConsulta(consultarCatalogos, []).datos?.departamentos ?? [];

  // Consulta cada vez que cambian los filtros (y con recargar(), al guardar).
  const {
    datos: resultado,
    error,
    cargando,
    recargar,
  } = useConsulta(
    () =>
      consultarFuncionarios({
        pagina,
        tamano: TAMANO_DE_PAGINA,
        busqueda: busquedaEnUrl || undefined,
        estado: estado || undefined,
        departamentoId: departamentoId || undefined,
        jefatura: soloRevisar ? 'revisar' : undefined,
      }),
    [pagina, busquedaEnUrl, estado, departamentoId, soloRevisar],
  );

  // Cuantas personas necesitan nueva jefatura (solo le sirve a quien puede editar).
  const puedeEditar = tienePermisos('funcionarios.editar');
  const porRevisar = useConsulta(puedeEditar ? () => consultarFuncionarios({ jefatura: 'revisar', tamano: 1 }) : null, [puedeEditar]);

  function alGuardar(texto: string) {
    setVentana(null);
    setAviso(texto);
    recargar();
    porRevisar.recargar();
  }

  const bloqueoRegistrar = tienePermisos('funcionarios.crear') ? null : 'su cuenta no tiene permiso para registrar funcionarios.';
  const hayFiltros = Boolean(busquedaEnUrl || estado || departamentoId || soloRevisar);
  const cuantosPorRevisar = porRevisar.datos?.total ?? 0;

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Funcionarios</h1>
          <p>Busque por cédula, nombre o correo. Los resultados vienen paginados: el sistema nunca carga todos los registros de una vez.</p>
        </div>
        <div className="acc">
          <BotonConAyuda
            clase="btn btn-primario"
            icono="mas"
            texto="Registrar funcionario"
            ayuda="Registrar a una persona nueva (se abre la página de registro por pasos)"
            bloqueadoPor={bloqueoRegistrar}
            alHacerClic={() => navegar('/funcionarios/nuevo')}
          />
        </div>
      </div>

      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input
            type="search"
            placeholder="Cédula, nombre o correo"
            aria-label="Buscar funcionarios por cédula, nombre o correo"
            value={textoBuscado}
            onChange={(e) => setTextoBuscado(e.target.value)}
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
              data-ayuda={filtro.valor ? `Mostrar solo los funcionarios ${filtro.texto.toLowerCase()}` : 'Mostrar todos'}
              onClick={() => cambiar({ estado: filtro.valor })}
            >
              {filtro.texto}
            </button>
          ))}
        </div>
        <label className="filtro-select">
          <span className="solo-lector">Filtrar por departamento</span>
          <select value={departamentoId} onChange={(e) => cambiar({ departamento: e.target.value })} data-ayuda="Filtrar por departamento">
            <option value="">Todos los departamentos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
                {d.activo ? '' : ' (inactivo)'}
              </option>
            ))}
          </select>
        </label>
        {(soloRevisar || cuantosPorRevisar > 0) && (
          <button
            type="button"
            className="filtro"
            aria-pressed={soloRevisar}
            data-ayuda="Mostrar solo a quienes necesitan nueva jefatura (la suya salió o dejó de ser Aprobadora)"
            onClick={() => cambiar({ jefatura: soloRevisar ? '' : 'revisar' })}
          >
            Revisar jefatura
          </button>
        )}
      </div>

      {puedeEditar && cuantosPorRevisar > 0 && !soloRevisar && (
        <Mensaje tipo="advert">
          {personasACargo(cuantosPorRevisar)} {cuantosPorRevisar === 1 ? 'necesita' : 'necesitan'} nueva jefatura: la suya salió de la
          Municipalidad o dejó de ser Aprobadora.{' '}
          <Link to="/funcionarios?jefatura=revisar">Ver quiénes</Link>
        </Mensaje>
      )}

      <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {!error && resultado && resultado.datos.length === 0 && !cargando && (
        <div className="vacio">
          {hayFiltros ? (
            <>
              <h3>Sin resultados</h3>
              <p>Ningún funcionario coincide con ese criterio. Revise la cédula o pruebe con parte del nombre.</p>
            </>
          ) : (
            <>
              <h3>Todavía no hay funcionarios</h3>
              <p>Registre el primero con el botón «Registrar funcionario».</p>
            </>
          )}
        </div>
      )}

      {!error && resultado && resultado.datos.length > 0 && (
        <>
          <div className="tabla-envoltura" aria-busy={cargando}>
            <table>
              <caption className="solo-lector">Funcionarios. Toque una fila para ver la ficha resumida; las acciones están en la última columna.</caption>
              <thead>
                <tr>
                  <th scope="col">Funcionario</th>
                  <th scope="col">Cédula</th>
                  <th scope="col">Puesto</th>
                  <th scope="col">Departamento</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="acciones">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultado.datos.map((f) => {
                  const nombre = nombreCompleto(f);
                  const salida = motivoParaSalida(f, tienePermisos);
                  return (
                    <tr
                      key={f.id}
                      data-abrible
                      tabIndex={0}
                      onClick={() => cambiar({ ver: f.id })}
                      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && cambiar({ ver: f.id })}
                      aria-label={`${nombre}, cédula ${f.cedula}. Presione Enter para ver la ficha resumida.`}
                    >
                      <td data-etiqueta="Funcionario">
                        <div className="celda-usuario">
                          <div className="avatar-sm" aria-hidden="true">
                            <FotoOIniciales src={f.tieneFoto ? direccionDeFoto(f.id, 0) : undefined} iniciales={inicialesDeFuncionario(f)} />
                          </div>
                          <div>
                            <span className="nom">{nombre}</span>
                            <span className="sec">{f.correoInstitucional ?? f.correoPersonal}</span>
                          </div>
                        </div>
                      </td>
                      <td data-etiqueta="Cédula" className="num">
                        {f.cedula}
                      </td>
                      <td data-etiqueta="Puesto">{f.puesto?.nombre ?? <span className="sec-dato">Sin puesto</span>}</td>
                      <td data-etiqueta="Departamento">{f.departamento?.nombre ?? <span className="sec-dato">Sin departamento</span>}</td>
                      <td data-etiqueta="Estado">
                        <ChipDeFuncionario estado={f.estado} />
                        {f.revisarJefatura && <ChipRevisarJefatura />}
                      </td>
                      <td className="acciones">
                        <BotonIcono icono="ojo" texto="Ver ficha resumida" sobre={nombre} alHacerClic={() => cambiar({ ver: f.id })} />
                        <BotonIcono
                          icono="editar"
                          texto="Editar funcionario"
                          sobre={nombre}
                          bloqueadoPor={motivoParaEditar(f, tienePermisos)}
                          alHacerClic={() => navegar(`/funcionarios/${f.id}/editar`)}
                        />
                        {f.estado === 'activo' ? (
                          <BotonIcono
                            icono="salir"
                            peligro
                            texto="Registrar salida"
                            sobre={nombre}
                            bloqueadoPor={salida}
                            alHacerClic={() => setVentana({ tipo: 'salida', f })}
                          />
                        ) : (
                          <BotonIcono
                            icono="reactivar"
                            texto="Registrar reingreso"
                            sobre={nombre}
                            bloqueadoPor={salida}
                            alHacerClic={() => setVentana({ tipo: 'reingreso', f })}
                          />
                        )}
                        <BotonIcono
                          icono="carpeta"
                          texto="Abrir expediente"
                          sobre={nombre}
                          bloqueadoPor={motivoParaExpediente(f, tienePermisos)}
                          alHacerClic={() => navegar(`/funcionarios/${f.id}/expediente`)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion resultado={resultado} nombre={['funcionario', 'funcionarios']} alCambiar={(n) => cambiar({ pagina: String(n) })}
          />
        </>
      )}

      {cargando && !resultado && <p style={{ color: 'var(--texto-sec)' }}>Cargando funcionarios…</p>}

      {/* ---------------- Ventanas ---------------- */}
      {verId && !ventana && (
        <ModalFicha
          funcionarioId={verId}
          bloqueoEditar={(f) => motivoParaEditar(f, tienePermisos)}
          bloqueoExpediente={(f) => motivoParaExpediente(f, tienePermisos)}
          alCerrar={() => cambiar({ ver: '' })}
          alEditar={() => navegar(`/funcionarios/${verId}/editar`)}
          alVerExpediente={() => navegar(`/funcionarios/${verId}/expediente`)}
        />
      )}
      {ventana?.tipo === 'salida' && (
        <ModalSalida
          funcionario={{ id: ventana.f.id, nombre: nombreCompleto(ventana.f), tieneCuenta: ventana.f.tieneCuenta, cantidadACargo: ventana.f.cantidadACargo }}
          alCerrar={() => setVentana(null)}
          alGuardar={alGuardar}
        />
      )}
      {ventana?.tipo === 'reingreso' && (
        <ModalReingreso
          funcionario={{ id: ventana.f.id, nombre: nombreCompleto(ventana.f), tieneCuenta: ventana.f.tieneCuenta }}
          alCerrar={() => setVentana(null)}
          alGuardar={alGuardar}
        />
      )}
    </section>
  );
}
