/*
 * Pagina "Usuarios" (seccion pgUsuarios del prototipo).
 *
 * Lista las cuentas con busqueda, filtro por estado y paginacion.
 * Regla de SIGEL: lo que se CONSULTA va en ventana; lo que se CREA o EDITA
 * va en una pagina aparte, por pasos.
 *   - Tocar una fila          -> ventana "Ver usuario" (solo lectura), con el
 *                                boton "Editar usuario".
 *   - Acciones de cada fila   -> Editar usuario (pagina) | Permisos
 *                                individuales (ventana de consulta; agregar
 *                                una excepcion es otra pagina) | Cambiar
 *                                estado (ventana de confirmacion). Si una
 *                                accion no se puede, el boton queda atenuado
 *                                y su ayuda dice por que.
 *   - "Crear usuario"         -> pagina /usuarios/nuevo.
 *
 * Los filtros y la ventana abierta viven en la URL (?busqueda=&estado=&pagina=,
 * ?ver=<id> y ?permisos=<id>): el boton "atras" funciona y las paginas de
 * edicion pueden volver a la ventana de la que salieron.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { textoDelError } from '../../api/cliente';
import { consultarCuentas, type CuentaEnLista, type EstadoDeCuenta, type Pagina } from '../../api/usuarios';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { useSesion } from '../../sesion/SesionProveedor';
import { formatearFechaHora } from '../../utilidades/fechas';
import { inicialesDeFuncionario, nombreCompleto } from '../../utilidades/texto';
import { ChipDeEstadoDeCuenta } from './ChipDeEstadoDeCuenta';
import { ModalCambiarEstado, ModalPermisosIndividuales, type CuentaDeFila } from './ModalesDeCuenta';
import { ModalVerUsuario } from './ModalVerUsuario';
import { motivoDeBloqueo } from './motivos';

const TAMANO_DE_PAGINA = 20;

/** Filtros de estado, en el orden del prototipo. */
const FILTROS_DE_ESTADO: { valor: EstadoDeCuenta | ''; texto: string }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'activo', texto: 'Activos' },
  { valor: 'inactivo', texto: 'Inactivos' },
  { valor: 'bloqueado', texto: 'Bloqueados' },
];

/** Ventana de "Cambiar estado" (las de ver y permisos van en la URL). */
type Ventana = { tipo: 'estado'; cuenta: CuentaDeFila } | null;

export function ListaDeUsuarios() {
  const { tienePermisos } = useSesion();
  const navegar = useNavigate();
  const [parametros, cambiarParametros] = useParametrosEnUrl({ reiniciaPagina: true, salvo: ['ver', 'permisos'] });
  const busquedaEnUrl = parametros.get('busqueda') ?? '';
  const estado = (parametros.get('estado') ?? '') as EstadoDeCuenta | '';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  /** Cuenta abierta en "Ver usuario" (va en la URL). */
  const verId = parametros.get('ver');
  /** Cuenta abierta en "Permisos individuales" (va en la URL). */
  const permisosId = parametros.get('permisos');

  const [textoBuscado, setTextoBuscado] = useState(busquedaEnUrl);
  const [resultado, setResultado] = useState<Pagina<CuentaEnLista> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ventana, setVentana] = useState<Ventana>(null);
  /** Cambia para forzar que la lista se vuelva a pedir. */
  const [recarga, setRecarga] = useState(0);
  const recargar = useCallback(() => setRecarga((n) => n + 1), []);


  // Busca medio segundo despues de dejar de escribir.
  useEffect(() => {
    if (textoBuscado.trim() === busquedaEnUrl) return;
    const espera = window.setTimeout(() => cambiarParametros({ busqueda: textoBuscado.trim() }), 450);
    return () => window.clearTimeout(espera);
  }, [textoBuscado, busquedaEnUrl, cambiarParametros]);

  // Consulta cada vez que cambian los filtros o se pide recargar.
  useEffect(() => {
    let vigente = true; // evita que una respuesta vieja pise a una nueva
    setCargando(true);
    setError(null);
    consultarCuentas({ pagina, tamano: TAMANO_DE_PAGINA, busqueda: busquedaEnUrl || undefined, estado: estado || undefined })
      .then((datos) => vigente && setResultado(datos))
      .catch((e) => vigente && setError(textoDelError(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pagina, busquedaEnUrl, estado, recarga]);

  function cuentaDeFila(c: CuentaEnLista): CuentaDeFila {
    return { id: c.id, correo: c.correo, estado: c.estado, nombre: nombreCompleto(c.funcionario) };
  }

  /** Al guardar en una ventana: cerrarla, avisar y recargar la lista. */
  function alGuardar(texto: string) {
    setVentana(null);
    setAviso(texto);
    recargar();
  }

  const bloqueoCrear = tienePermisos('usuarios.crear') ? null : 'su cuenta no tiene permiso para crear usuarios.';

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Usuarios</h1>
          <p>Cuentas de acceso al sistema. Cada cuenta pertenece a un funcionario. Toque una fila para ver el detalle.</p>
        </div>
        <div className="acc">
          <BotonConAyuda
            clase="btn btn-primario"
            icono="mas"
            texto="Crear usuario"
            ayuda="Crear la cuenta de acceso de un funcionario"
            bloqueadoPor={bloqueoCrear}
            alHacerClic={() => navegar('/usuarios/nuevo')}
          />
        </div>
      </div>

      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input
            type="search"
            placeholder="Buscar por correo, nombre o cédula"
            aria-label="Buscar usuarios por correo, nombre o cédula"
            value={textoBuscado}
            onChange={(e) => setTextoBuscado(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="filtros" role="group" aria-label="Filtrar por estado">
          {FILTROS_DE_ESTADO.map((filtro) => (
            <button
              key={filtro.texto}
              type="button"
              className="filtro"
              aria-pressed={estado === filtro.valor}
              data-ayuda={filtro.valor ? `Mostrar solo las cuentas en estado "${filtro.texto.toLowerCase()}"` : 'Mostrar todas las cuentas'}
              onClick={() => cambiarParametros({ estado: filtro.valor })}
            >
              {filtro.texto}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">
        {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      {!error && resultado && resultado.datos.length === 0 && !cargando && (
        <div className="vacio">
          <h3>No hay cuentas que coincidan</h3>
          <p>Pruebe con otra búsqueda o quite el filtro de estado.</p>
        </div>
      )}

      {!error && resultado && resultado.datos.length > 0 && (
        <>
          <div className="tabla-envoltura" aria-busy={cargando}>
            <table>
              <caption className="solo-lector">
                Cuentas de usuario. Toque una fila para ver el detalle; las acciones están en la última columna.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Roles</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Último acceso</th>
                  <th scope="col" className="acciones">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultado.datos.map((cuenta) => (
                  <FilaDeCuenta
                    key={cuenta.id}
                    cuenta={cuenta}
                    alVer={() => cambiarParametros({ ver: cuenta.id })}
                    alEditar={() => navegar(`/usuarios/${cuenta.id}/editar`)}
                    alPermisos={() => cambiarParametros({ permisos: cuenta.id })}
                    alEstado={() => setVentana({ tipo: 'estado', cuenta: cuentaDeFila(cuenta) })}
                    motivo={(accion) => motivoDeBloqueo(accion, cuenta.motivoNoModificable, tienePermisos)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            pagina={resultado.pagina}
            totalPaginas={resultado.totalPaginas}
            total={resultado.total}
            tamano={resultado.tamano}
            alCambiar={(n) => cambiarParametros({ pagina: String(n) })}
          />
        </>
      )}

      {cargando && !resultado && <p style={{ color: 'var(--texto-sec)' }}>Cargando cuentas…</p>}

      {/* ---------------- Ventanas ---------------- */}
      {verId && !ventana && (
        <ModalVerUsuario
          usuarioId={verId}
          alCerrar={() => cambiarParametros({ ver: '' })}
          alEditar={(id) => navegar(`/usuarios/${id}/editar`)}
        />
      )}
      {permisosId && !verId && (
        <ModalPermisosIndividuales usuarioId={permisosId} alCerrar={() => cambiarParametros({ permisos: '' })} alCambiar={recargar} />
      )}
      {ventana?.tipo === 'estado' && (
        <ModalCambiarEstado cuenta={ventana.cuenta} alCerrar={() => setVentana(null)} alGuardar={alGuardar} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function FilaDeCuenta({
  cuenta,
  alVer,
  alEditar,
  alPermisos,
  alEstado,
  motivo,
}: {
  cuenta: CuentaEnLista;
  alVer: () => void;
  alEditar: () => void;
  alPermisos: () => void;
  alEstado: () => void;
  motivo: (accion: 'editar' | 'permisos' | 'estado') => string | null;
}) {
  const nombre = nombreCompleto(cuenta.funcionario);
  return (
    // Toda la fila abre "Ver usuario" (clic o Enter), como en el prototipo.
    <tr
      data-abrible
      tabIndex={0}
      onClick={alVer}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && alVer()}
      aria-label={`${nombre}, ${cuenta.correo}. Presione Enter para ver el detalle.`}
    >
      <td data-etiqueta="Usuario">
        <div className="celda-usuario">
          <div className="avatar-sm" aria-hidden="true">
            {inicialesDeFuncionario(cuenta.funcionario)}
          </div>
          <div>
            <span className="nom">{nombre}</span>
            <span className="sec">{cuenta.correo}</span>
          </div>
        </div>
      </td>
      <td data-etiqueta="Roles">
        <div className="pills">
          {cuenta.roles.length === 0 ? (
            <span className="chip-rol">Sin roles vigentes</span>
          ) : (
            cuenta.roles.map((rol) => (
              <span className="chip-rol sistema" key={rol.id}>
                {rol.nombre}
              </span>
            ))
          )}
        </div>
      </td>
      <td data-etiqueta="Estado">
        <ChipDeEstadoDeCuenta cuenta={cuenta} />
      </td>
      <td data-etiqueta="Último acceso" className="num">
        {cuenta.ultimoAcceso ? formatearFechaHora(cuenta.ultimoAcceso) : 'Nunca ha ingresado'}
      </td>
      <td className="acciones">
        <BotonIcono icono="editar" texto="Editar usuario" sobre={nombre} bloqueadoPor={motivo('editar')} alHacerClic={alEditar} />
        <BotonIcono icono="llave" texto="Permisos individuales" sobre={nombre} bloqueadoPor={motivo('permisos')} alHacerClic={alPermisos} />
        <BotonIcono
          icono="candado"
          peligro
          texto="Cambiar estado de la cuenta"
          sobre={nombre}
          bloqueadoPor={motivo('estado')}
          alHacerClic={alEstado}
        />
      </td>
    </tr>
  );
}

function Paginacion(props: { pagina: number; totalPaginas: number; total: number; tamano: number; alCambiar: (pagina: number) => void }) {
  const { pagina, totalPaginas, total, tamano, alCambiar } = props;
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  return (
    <nav className="paginacion" aria-label="Paginación de la lista de usuarios">
      <span aria-live="polite">
        {desde}–{hasta} de {total} cuenta{total === 1 ? '' : 's'}
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
