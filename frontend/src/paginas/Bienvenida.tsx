/*
 * Bienvenida (/ sin sesion, 17/10). Pagina publica: que es SINERGIA, que
 * hace y dos caminos: ingresar (funcionarios) o postularse al Talent Pool.
 * No muestra ningun dato de personas: las "vistas" de cada funcion son
 * dibujos con datos de ejemplo, no informacion real.
 *
 * Interactiva sin cargar nada: el explorador de funciones (pestañas que
 * cambian la vista), las preguntas frecuentes (se abren y cierran) y una
 * sola animacion al cargar (la semana del calendario se va llenando), que
 * se omite si la persona pidio reducir el movimiento.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BotonTema } from '../componentes/BotonTema';
import { Icono, type NombreDeIcono } from '../componentes/Icono';
import logoClaro from '../recursos/logo-claro.png';
import logoOscuro from '../recursos/logo-oscuro.png';
import simboloSinergia from '../recursos/sinergia-simbolo.png';

interface Funcion {
  clave: string;
  icono: NombreDeIcono;
  titulo: string;
  resumen: string;
  puntos: string[];
  vista: ReactNode;
}

const FUNCIONES: Funcion[] = [
  {
    clave: 'expediente',
    icono: 'carpeta',
    titulo: 'Expediente laboral',
    resumen: 'Cada funcionario tiene su expediente digital: datos, documentos e historial laboral en un solo lugar.',
    puntos: [
      'Los documentos se guardan cifrados y solo los abre quien tiene permiso.',
      'Cada persona ve y completa su propio expediente desde la computadora o el celular.',
      'Recursos Humanos consulta el historial sin buscar en archivos de papel.',
    ],
    vista: <VistaExpediente />,
  },
  {
    clave: 'vacaciones',
    icono: 'sombrilla',
    titulo: 'Vacaciones y permisos',
    resumen: 'Pedir vacaciones toma tres pasos y el saldo se calcula solo, según los años de servicio.',
    puntos: [
      'La jefatura inmediata aprueba o rechaza desde su bandeja.',
      'Al aprobarse, se genera la constancia en PDF y queda en el expediente.',
      'El sistema avisa con un mes de anticipación antes de llegar al tope de periodos.',
    ],
    vista: <VistaSaldo />,
  },
  {
    clave: 'calendario',
    icono: 'calendario',
    titulo: 'Calendario del equipo',
    resumen: 'Quién está fuera esta semana, de un vistazo, con los feriados ya marcados.',
    puntos: [
      'La jefatura ve a su equipo y Recursos Humanos a todo el personal.',
      'Avisa cuando una solicitud coincide con las ausencias de otros compañeros.',
      'Las incapacidades se muestran solo con sus fechas, sin datos médicos.',
    ],
    vista: <VistaCalendario />,
  },
  {
    clave: 'avisos',
    icono: 'campana',
    titulo: 'Avisos dentro del sistema',
    resumen: 'Cada persona recibe solo lo que le corresponde, en el momento en que pasa.',
    puntos: [
      'La jefatura se entera de una solicitud nueva; Recursos Humanos, cuando ya está aprobada.',
      'Cada aviso abre directamente el trámite.',
      'Se marcan como leídos uno por uno o todos a la vez.',
    ],
    vista: <VistaAvisos />,
  },
  {
    clave: 'seguridad',
    icono: 'candado',
    titulo: 'Seguridad y auditoría',
    resumen: 'Cada cuenta ve solo lo que su rol permite, y los cambios importantes quedan registrados.',
    puntos: [
      'Roles y permisos definidos por Recursos Humanos.',
      'Bitácora de auditoría con el antes y el después de cada cambio.',
      'Las sesiones se pueden cerrar desde el servidor y los intentos fallidos bloquean la cuenta.',
    ],
    vista: <VistaBitacora />,
  },
];

const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  { pregunta: '¿Necesito crear una cuenta?', respuesta: 'No. El formulario es abierto y usted se identifica solo con su número de cédula.' },
  {
    pregunta: '¿Qué pasa si ya me había registrado?',
    respuesta:
      'Vuelva a llenar el formulario completo con la misma cédula: su registro anterior se reemplaza por el nuevo. Por su privacidad, el formulario nunca muestra los datos que ya estaban guardados.',
  },
  { pregunta: '¿Quién ve mis datos?', respuesta: 'Solo el Departamento de Recursos Humanos de la Municipalidad. Su información no se publica ni se comparte con terceros.' },
  { pregunta: '¿Registrarme me garantiza una plaza?', respuesta: 'No. Le permite a Recursos Humanos considerar su perfil cuando se abra una plaza que se ajuste a lo que usted sabe hacer.' },
  { pregunta: '¿Puedo pedir que borren mis datos?', respuesta: 'Sí. Comuníquese con Recursos Humanos y se eliminarán por completo, como lo indica la Ley 8968 de protección de datos personales.' },
];

export function Bienvenida() {
  useEffect(() => {
    document.title = 'SINERGIA · Municipalidad de Palmares';
  }, []);

  return (
    <div className="bv">
      <header className="bv-barra">
        <a className="bv-marca" href="#arriba" aria-label="SINERGIA, inicio de la página">
          <img src={simboloSinergia} alt="" />
          <span>
            <b>SINERGIA</b>
            <small>Municipalidad de Palmares</small>
          </span>
        </a>
        <nav className="bv-nav" aria-label="Secciones">
          <a href="#funciones">Qué hace</a>
          <a href="#trabaje">Trabaje con nosotros</a>
        </nav>
        <div className="bv-barra-acc">
          <BotonTema clase="btn-icono-claro" />
          <Link to="/iniciar-sesion" className="btn btn-primario btn-chico">
            Ingresar
          </Link>
        </div>
      </header>

      <main id="arriba">
        <section className="bv-portada">
          <div className="bv-portada-texto">
            <p className="bv-entrada">Recursos Humanos de la Municipalidad de Palmares</p>
            <h1>El trabajo de toda la Municipalidad, organizado en un solo lugar.</h1>
            <p className="bv-bajada">
              SINERGIA es el sistema con el que la Municipalidad administra el expediente laboral, las vacaciones, los permisos y las incapacidades de su personal.
            </p>
            <div className="bv-caminos">
              <Link to="/iniciar-sesion" className="bv-camino bv-camino-principal">
                <Icono nombre="llave" tamano={22} />
                <span>
                  <b>Ingresar a SINERGIA</b>
                  <small>Para funcionarios de la Municipalidad</small>
                </span>
              </Link>
              <Link to="/trabaje-con-nosotros" className="bv-camino">
                <Icono nombre="maletin" tamano={22} />
                <span>
                  <b>Postularme al Talent Pool</b>
                  <small>Para quien quiere trabajar con nosotros</small>
                </span>
              </Link>
            </div>
          </div>
          <SemanaAnimada />
        </section>

        <section className="bv-seccion" id="funciones" aria-labelledby="titulo-funciones">
          <h2 id="titulo-funciones">Qué hace SINERGIA</h2>
          <p className="bv-intro">Cinco funciones que reemplazan formularios en papel, correos sueltos y hojas de cálculo. Elija una para verla.</p>
          <Explorador />
        </section>

        <section className="bv-seccion bv-roles" aria-labelledby="titulo-roles">
          <h2 id="titulo-roles">Cada quien ve lo que le toca</h2>
          <div className="bv-roles-filas">
            <div>
              <Icono nombre="cuenta" tamano={24} />
              <h3>Funcionarios</h3>
              <p>Consultan su saldo, piden vacaciones y permisos, registran incapacidades y mantienen al día sus datos y documentos.</p>
            </div>
            <div>
              <Icono nombre="personas" tamano={24} />
              <h3>Jefaturas</h3>
              <p>Aprueban las solicitudes de su equipo y ven en el calendario quién estará fuera antes de decidir.</p>
            </div>
            <div>
              <Icono nombre="bandeja" tamano={24} />
              <h3>Recursos Humanos</h3>
              <p>Registran al personal, llevan los expedientes, las reglas de vacaciones y el Talent Pool para nuevas contrataciones.</p>
            </div>
          </div>
        </section>

        <section className="bv-talento" id="trabaje" aria-labelledby="titulo-talento">
          <div className="bv-talento-interior">
            <div className="bv-talento-texto">
              <h2 id="titulo-talento">¿Quiere formar parte de nuestro equipo?</h2>
              <p>
                El Talent Pool es la base de candidatos de la Municipalidad de Palmares. Deje sus datos, estudios, experiencia y currículum, y Recursos Humanos podrá
                considerarlo cuando se abra una plaza que se ajuste a su perfil.
              </p>
              <ol className="bv-pasos">
                <li>
                  <b>Llene el formulario</b>
                  <span>Sin crear cuenta: se identifica con su cédula. Toma unos 10 minutos.</span>
                </li>
                <li>
                  <b>Adjunte su currículum</b>
                  <span>En PDF. Queda guardado de forma segura y solo lo ve Recursos Humanos.</span>
                </li>
                <li>
                  <b>Recursos Humanos revisa los perfiles</b>
                  <span>Cuando hay una plaza, busca por profesión, estudios, experiencia y habilidades.</span>
                </li>
                <li>
                  <b>Lo contactan</b>
                  <span>Si su perfil encaja, le escriben al correo o lo llaman al teléfono que indicó.</span>
                </li>
              </ol>
              <Link to="/trabaje-con-nosotros" className="btn bv-boton-claro">
                Ir al formulario del Talent Pool
              </Link>
            </div>
            <div className="bv-preguntas">
              <h3>Preguntas frecuentes</h3>
              {PREGUNTAS.map((p) => (
                <details key={p.pregunta}>
                  <summary>{p.pregunta}</summary>
                  <p>{p.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bv-pie">
        <img className="logo-claro" src={logoClaro} alt="Municipalidad de Palmares" />
        <img className="logo-oscuro" src={logoOscuro} alt="Municipalidad de Palmares" />
        <p>
          Municipalidad de Palmares, Alajuela, Costa Rica.
          <br />
          SINERGIA, sistema de gestión de personal.
        </p>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* Explorador de funciones (pestañas accesibles)                       */
/* ================================================================== */

function Explorador() {
  const [actual, setActual] = useState(0);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const f = FUNCIONES[actual];

  function teclas(e: KeyboardEvent) {
    const mover = (n: number) => {
      e.preventDefault();
      const destino = (actual + n + FUNCIONES.length) % FUNCIONES.length;
      setActual(destino);
      botones.current[destino]?.focus();
    };
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') mover(1);
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') mover(-1);
  }

  return (
    <div className="bv-explorador">
      <div className="bv-pestanas" role="tablist" aria-label="Funciones de SINERGIA" aria-orientation="vertical" onKeyDown={teclas}>
        {FUNCIONES.map((x, i) => (
          <button
            key={x.clave}
            ref={(b) => {
              botones.current[i] = b;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === actual}
            aria-controls={`${id}-panel`}
            tabIndex={i === actual ? 0 : -1}
            onClick={() => setActual(i)}
          >
            <Icono nombre={x.icono} tamano={20} />
            <span>{x.titulo}</span>
          </button>
        ))}
      </div>
      <div className="bv-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${actual}`} key={f.clave}>
        <div className="bv-panel-vista" aria-hidden="true">
          {f.vista}
        </div>
        <div className="bv-panel-texto">
          <h3>{f.titulo}</h3>
          <p>{f.resumen}</p>
          <ul>
            {f.puntos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Vistas de ejemplo (dibujos: no son datos reales)                     */
/* ================================================================== */

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

/** La semana del calendario, que se va llenando al cargar (la unica animacion automatica). */
function SemanaAnimada() {
  const marcas: { dia: number; tipo: string }[][] = [
    [{ dia: 0, tipo: 'vac' }],
    [{ dia: 1, tipo: 'vac' }, { dia: 1, tipo: 'per' }],
    [{ dia: 2, tipo: 'fer' }],
    [{ dia: 3, tipo: 'vac' }, { dia: 3, tipo: 'inc' }, { dia: 3, tipo: 'cap' }],
    [{ dia: 4, tipo: 'vac' }],
  ];
  return (
    <figure className="bv-semana" aria-label="Ejemplo del calendario del equipo">
      <figcaption>Su equipo esta semana</figcaption>
      <div className="bv-semana-dias">
        {DIAS.map((d, i) => (
          <div key={d} className={i === 2 ? 'bv-dia bv-dia-feriado' : 'bv-dia'} style={{ ['--orden' as string]: i }}>
            <span className="bv-dia-nombre">{d}</span>
            <span className="bv-dia-marcas">
              {i === 2 ? (
                <span className="bv-feriado">Feriado</span>
              ) : (
                marcas[i].map((m, j) => <span key={j} className={`bv-punto bv-${m.tipo}`} style={{ ['--orden' as string]: i * 3 + j }} />)
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="bv-leyenda">
        <span>
          <i className="bv-punto bv-vac" /> Vacaciones
        </span>
        <span>
          <i className="bv-punto bv-per" /> Permiso
        </span>
        <span>
          <i className="bv-punto bv-inc" /> Incapacidad
        </span>
        <span>
          <i className="bv-punto bv-cap" /> Capacitación
        </span>
      </div>
    </figure>
  );
}

function VistaExpediente() {
  return (
    <div className="bv-v bv-v-exp">
      {['Título universitario', 'Acción de personal', 'Constancia de vacaciones'].map((t, i) => (
        <div key={t} className="bv-v-doc" style={{ ['--i' as string]: i }}>
          <Icono nombre="documento" tamano={18} />
          <span>{t}</span>
          <Icono nombre="candado" tamano={14} />
        </div>
      ))}
    </div>
  );
}

function VistaSaldo() {
  return (
    <div className="bv-v bv-v-saldo">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="50" className="bv-anillo-fondo" />
        <circle cx="60" cy="60" r="50" className="bv-anillo" strokeDasharray={`${2 * Math.PI * 50 * 0.6} 400`} transform="rotate(-90 60 60)" />
      </svg>
      <div className="bv-v-saldo-cifra">
        <b>18</b>
        <span>días disponibles</span>
      </div>
      <div className="bv-v-pasos">
        <span className="hecho">Qué</span>
        <span className="hecho">Cuándo</span>
        <span>Enviar</span>
      </div>
    </div>
  );
}

function VistaCalendario() {
  return (
    <div className="bv-v bv-v-cal">
      {Array.from({ length: 15 }, (_, i) => (
        <span key={i} className={`bv-v-celda${i === 7 ? ' hoy' : ''}${[3, 4, 9].includes(i) ? ' ocupada' : ''}${i === 11 ? ' feriado' : ''}`}>{i + 6}</span>
      ))}
    </div>
  );
}

function VistaAvisos() {
  return (
    <div className="bv-v bv-v-avisos">
      <div className="bv-v-campana">
        <Icono nombre="campana" tamano={22} />
        <span>3</span>
      </div>
      <div className="bv-v-aviso">
        <b>Solicitud por aprobar</b>
        <span>Vacaciones del 3 al 5 de noviembre</span>
      </div>
      <div className="bv-v-aviso leido">
        <b>Solicitud aprobada</b>
        <span>Su permiso del viernes fue aprobado</span>
      </div>
    </div>
  );
}

function VistaBitacora() {
  return (
    <div className="bv-v bv-v-bit">
      <div className="bv-v-fila">
        <span>Dato</span>
        <span>Antes</span>
        <span>Después</span>
      </div>
      <div className="bv-v-fila">
        <span>Teléfono</span>
        <span className="antes">8888-0000</span>
        <span className="despues">8888-1234</span>
      </div>
      <div className="bv-v-fila">
        <span>Puesto</span>
        <span className="antes">Asistente</span>
        <span className="despues">Coordinador</span>
      </div>
    </div>
  );
}
