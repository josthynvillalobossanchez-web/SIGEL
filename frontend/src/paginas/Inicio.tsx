/*
 * Pagina de inicio.
 *
 *   - Saludo con el nombre de la persona.
 *   - Si le faltan datos personales (nacimiento, telefono...), un aviso con
 *     el enlace a Mi cuenta para completarlos.
 *   - Para quien ve funcionarios o usuarios, un resumen con cifras que
 *     llevan a la lista ya filtrada (p. ej. las cuentas bloqueadas).
 *   - Accesos directos: las mismas opciones del menu lateral que la cuenta
 *     puede abrir (MENU + puedeVerOpcion), con su descripcion. Al agregar
 *     una pagina al menu aparece aqui sola.
 */
import { Link } from 'react-router';
import { consultarFuncionarios } from '../api/funcionarios';
import { consultarMiCuenta } from '../api/miCuenta';
import { consultarCuentas } from '../api/usuarios';
import { Icono } from '../componentes/Icono';
import { Mensaje } from '../componentes/Mensaje';
import { MENU, puedeVerOpcion } from '../diseno/menu';
import { useSesion } from '../sesion/SesionProveedor';
import { useConsulta } from '../utilidades/useConsulta';

/** "Buenos dias" / "Buenas tardes" / "Buenas noches" segun la hora de Costa Rica. */
function saludo(): string {
  const hora = Number(new Intl.DateTimeFormat('es-CR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Costa_Rica' }).format(new Date()));
  return hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
}

export function Inicio() {
  const { usuario, tienePermisos } = useSesion();
  const tieneFuncionario = Boolean(usuario?.funcionarioId);
  const perfil = useConsulta(tieneFuncionario ? consultarMiCuenta : null, [tieneFuncionario]).datos;
  if (!usuario) return null;

  const f = perfil?.funcionario;
  const accesos = MENU.flatMap((grupo) => grupo.opciones).filter((o) => o.ruta !== '/' && puedeVerOpcion(o, tienePermisos, tieneFuncionario));
  // Datos personales que conviene tener (el correo personal ya es obligatorio).
  const faltan = f
    ? [
        !f.fechaNacimiento && 'fecha de nacimiento',
        !f.telefonoPersonal && 'teléfono',
        !f.direccion && 'dirección',
        !f.profesion && 'profesión',
      ].filter((x): x is string => Boolean(x))
    : [];

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>
            {saludo()}
            {f ? `, ${f.nombre}` : ''}
          </h1>
          <p>Sistema Integrado de Nómina, Expediente, Recursos y Gestión de Incapacidades y Ausencias de la Municipalidad de Palmares.</p>
        </div>
      </div>

      {perfil?.puedeEditarDatos && faltan.length > 0 && (
        <Mensaje tipo="info">
          A su perfil le falta: {faltan.join(', ')}. <Link to="/mi-cuenta">Complételo en Mi cuenta</Link> (así Recursos Humanos
          tiene sus datos al día).
        </Mensaje>
      )}

      <Resumen />

      <h2 className="inicio-titulo">Accesos directos</h2>
      <div className="inicio-rejilla">
        {accesos.map((opcion) => (
          <Link className="inicio-tarjeta" to={opcion.ruta} key={opcion.ruta}>
            <span className="ico-grande">
              <Icono nombre={opcion.icono} tamano={20} />
            </span>
            <b>{opcion.texto}</b>
            {opcion.descripcion && <span>{opcion.descripcion}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Cifras para Recursos Humanos: cada una lleva a la lista ya filtrada. Solo
 * se piden las que la cuenta puede ver (tamano 1: solo interesa el total).
 */
function Resumen() {
  const { tienePermisos } = useSesion();
  const verFuncionarios = tienePermisos('funcionarios.ver');
  const verUsuarios = tienePermisos('usuarios.ver');
  const editarFuncionarios = tienePermisos('funcionarios.editar');
  const activos = useConsulta(verFuncionarios ? () => consultarFuncionarios({ estado: 'activo', tamano: 1 }) : null, []).datos;
  const bloqueadas = useConsulta(verUsuarios ? () => consultarCuentas({ estado: 'bloqueado', tamano: 1 }) : null, []).datos;
  const inactivas = useConsulta(verUsuarios ? () => consultarCuentas({ estado: 'inactivo', tamano: 1 }) : null, []).datos;
  // Personal cuya jefatura salio o dejo de ser Aprobadora (decision del 30/09).
  const porRevisar = useConsulta(editarFuncionarios ? () => consultarFuncionarios({ jefatura: 'revisar', tamano: 1 }) : null, []).datos;

  const cifras = [
    verFuncionarios && { valor: activos?.total, texto: 'funcionarios activos', a: '/funcionarios?estado=activo', ayuda: 'Ver la lista de funcionarios activos' },
    verUsuarios && {
      valor: bloqueadas?.total,
      texto: 'cuentas bloqueadas',
      a: '/usuarios?estado=bloqueado',
      ayuda: 'Cuentas bloqueadas por intentos fallidos o por Recursos Humanos',
    },
    verUsuarios && { valor: inactivas?.total, texto: 'cuentas inactivas', a: '/usuarios?estado=inactivo', ayuda: 'Cuentas sin acceso (por ejemplo, por salida)' },
    editarFuncionarios && {
      valor: porRevisar?.total,
      texto: 'necesitan nueva jefatura',
      a: '/funcionarios?jefatura=revisar',
      ayuda: 'Personas cuya jefatura salió o dejó de ser Aprobadora: asígneles otra',
    },
  ].filter((c): c is { valor: number | undefined; texto: string; a: string; ayuda: string } => Boolean(c));
  if (cifras.length === 0) return null;

  return (
    <>
      <h2 className="inicio-titulo">Resumen</h2>
      <div className="inicio-cifras">
        {cifras.map((c) => (
          <Link className="inicio-cifra" to={c.a} key={c.a} data-ayuda={c.ayuda}>
            <b className="num">{c.valor ?? '…'}</b>
            <span>{c.texto}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
