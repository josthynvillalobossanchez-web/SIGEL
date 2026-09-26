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
 * Filtros y ficha abierta en la URL (?busqueda=&estado=&departamento=&pagina=&ver=).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { textoDelError } from '../../api/cliente';
import { consultarFuncionarios, type EstadoDeFuncionario, type FuncionarioEnLista } from '../../api/funcionarios';
import { consultarCatalogos, type ElementoDeCatalogo } from '../../api/catalogos';
import type { Pagina } from '../../api/usuarios';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { useSesion } from '../../sesion/SesionProveedor';
import { inicialesDeFuncionario, nombreCompleto } from '../../utilidades/texto';
import { ChipDeFuncionario } from './ChipDeFuncionario';
import { ModalFicha, ModalReingreso, ModalSalida } from './ModalesDeFuncionario';
import { MOTIVO_EXPEDIENTE_PENDIENTE, motivoParaEditar, motivoParaSalida } from './motivos';

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
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const verId = parametros.get('ver');

  const [textoBuscado, setTextoBuscado] = useState(busquedaEnUrl);
  const [resultado, setResultado] = useState<Pagina<FuncionarioEnLista> | null>(null);
  const [departamentos, setDepartamentos] = useState<ElementoDeCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [recarga, setRecarga] = useState(0);


  useEffect(() => {
    consultarCatalogos()
      .then((c) => setDepartamentos(c.departamentos))
      .catch(() => setDepartamentos([]));
  }, []);

  // Busca un momento despues de dejar de escribir.
  useEffect(() => {
    if (textoBuscado.trim() === busquedaEnUrl) return;
    const espera = window.setTimeout(() => cambiar({ busqueda: textoBuscado.trim() }), 450);
    return () => window.clearTimeout(espera);
  }, [textoBuscado, busquedaEnUrl, cambiar]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    consultarFuncionarios({
      pagina,
      tamano: TAMANO_DE_PAGINA,
      busqueda: busquedaEnUrl || undefined,
      estado: estado || undefined,
      departamentoId: departamentoId || undefined,
    })
      .then((d) => vigente && setResultado(d))
      .catch((e) => vigente && setError(textoDelError(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pagina, busquedaEnUrl, estado, departamentoId, recarga]);

  function alGuardar(texto: string) {
    setVentana(null);
    setAviso(texto);
    setRecarga((n) => n + 1);
  }

  const bloqueoRegistrar = tienePermisos('funcionarios.crear') ? null : 'su cuenta no tiene permiso para registrar funcionarios.';
  const hayFiltros = Boolean(busquedaEnUrl || estado || departamentoId);

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
      </div>

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
                            {inicialesDeFuncionario(f)}
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
                        <BotonIcono icono="carpeta" texto="Abrir expediente" sobre={nombre} bloqueadoPor={MOTIVO_EXPEDIENTE_PENDIENTE} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion
            pagina={resultado.pagina}
            totalPaginas={resultado.totalPaginas}
            total={resultado.total}
            tamano={resultado.tamano}
            alCambiar={(n) => cambiar({ pagina: String(n) })}
          />
        </>
      )}

      {cargando && !resultado && <p style={{ color: 'var(--texto-sec)' }}>Cargando funcionarios…</p>}

      {/* ---------------- Ventanas ---------------- */}
      {verId && !ventana && (
        <ModalFicha
          funcionarioId={verId}
          bloqueoEditar={(f) => motivoParaEditar(f, tienePermisos)}
          alCerrar={() => cambiar({ ver: '' })}
          alEditar={() => navegar(`/funcionarios/${verId}/editar`)}
        />
      )}
      {ventana?.tipo === 'salida' && (
        <ModalSalida
          funcionario={{ id: ventana.f.id, nombre: nombreCompleto(ventana.f), tieneCuenta: ventana.f.tieneCuenta }}
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

function Paginacion(props: { pagina: number; totalPaginas: number; total: number; tamano: number; alCambiar: (pagina: number) => void }) {
  const { pagina, totalPaginas, total, tamano, alCambiar } = props;
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  return (
    <nav className="paginacion" aria-label="Paginación de la lista de funcionarios">
      <span aria-live="polite">
        Mostrando {desde}–{hasta} de {total} funcionario{total === 1 ? '' : 's'}
      </span>
      <div className="paginas">
        <button className="pag-btn" type="button" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)} data-ayuda="Página anterior">
          Anterior
        </button>
        <span className="pag-btn" aria-current="page" aria-label={`Página ${pagina} de ${totalPaginas}`}>
          {pagina} / {totalPaginas}
        </span>
        <button className="pag-btn" type="button" disabled={pagina >= totalPaginas} onClick={() => alCambiar(pagina + 1)} data-ayuda="Página siguiente">
          Siguiente
        </button>
      </div>
    </nav>
  );
}
