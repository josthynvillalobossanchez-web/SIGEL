/*
 * Talent Pool: formulario PUBLICO (/trabaje-con-nosotros), sin cuenta.
 *
 * Reglas (Josthyn, 13/10):
 *   - La persona se identifica solo con su cedula.
 *   - Por privacidad, el formulario NUNCA trae datos guardados: si la cedula
 *     ya existe, se llena todo de nuevo y al enviar se reemplaza el registro
 *     anterior completo. Se avisa antes de enviar.
 *   - Consentimiento informado obligatorio (Ley 8968).
 *   - Curriculum opcional, solo PDF (hasta 10 MB).
 *
 * Por pasos, para no tener que bajar (celular primero):
 *   1. Datos personales  2. Estudios  3. Experiencia  4. Habilidades
 *   5. Currículum y consentimiento.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { textoDelError } from '../../api/cliente';
import {
  consultarFormularioPublico,
  enviarRegistroPublico,
  NOMBRE_DE_CATEGORIA,
  NOMBRE_DE_NIVEL_DE_HABILIDAD,
  type CategoriaDeHabilidad,
  type FormularioPublico,
  type NivelDeHabilidad,
  type NivelEducativo,
  type RegistroDeCandidato,
} from '../../api/talentPool';
import { BotonTema } from '../../componentes/BotonTema';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Texto } from '../../componentes/CamposDeFormulario';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Pasos } from '../../componentes/Pasos';
import { ZonaDeArchivo } from '../../componentes/ZonaDeArchivo';
import logoClaro from '../../recursos/logo-claro.png';
import logoOscuro from '../../recursos/logo-oscuro.png';
import simboloSinergia from '../../recursos/sinergia-simbolo.png';
import { problemaDeArchivo } from '../../utilidades/archivos';
import { hoyEnCostaRica } from '../../utilidades/fechas';
import { maximoDeNacimiento, normalizarTelefono, problemaDeCedula, problemaDeNacimiento, problemaDeNombres } from '../../utilidades/validaciones';

const TAMANO_MAXIMO_CV = 10 * 1024 * 1024;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Estudio {
  nivel: NivelEducativo | '';
  titulo: string;
  institucion: string;
  anioFinalizacion: string;
  concluido: boolean;
}
interface Experiencia {
  empresa: string;
  puesto: string;
  desde: string;
  hasta: string;
  esActual: boolean;
  descripcion: string;
}

const VACIO = {
  cedula: '',
  nombre: '',
  primerApellido: '',
  segundoApellido: '',
  correo: '',
  telefono: '',
  fechaNacimiento: '',
  residencia: '',
  profesionId: '',
  profesionTexto: '',
  descripcion: '',
};
type Personales = typeof VACIO;

const PASOS = [
  { titulo: 'Datos personales', sub: 'Quién es usted', descripcion: 'Su cédula es lo que lo identifica. Si ya se había registrado, al enviar se reemplazarán sus datos anteriores por estos.' },
  { titulo: 'Estudios', sub: 'Profesión y formación', descripcion: 'Su profesión y los estudios que ha cursado, incluidos cursos y capacitaciones.' },
  { titulo: 'Experiencia', sub: 'Trabajos anteriores', descripcion: 'Los trabajos que ha tenido. Si aún no tiene experiencia laboral, puede seguir sin agregar ninguno.' },
  { titulo: 'Habilidades', sub: 'Lo que sabe hacer', descripcion: 'Toque las que tiene. Si quiere, indique su nivel.' },
  { titulo: 'Enviar', sub: 'Currículum y consentimiento', descripcion: 'Adjunte su currículum (opcional), lea el consentimiento y envíe.' },
];

export function RegistroPublico() {
  const [formulario, setFormulario] = useState<FormularioPublico | null>(null);
  const [errorDeCarga, setErrorDeCarga] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Personales>(VACIO);
  const [noEncuentroProfesion, setNoEncuentroProfesion] = useState(false);
  const [estudios, setEstudios] = useState<Estudio[]>([]);
  const [experiencias, setExperiencias] = useState<Experiencia[]>([]);
  const [habilidades, setHabilidades] = useState<Record<string, NivelDeHabilidad | ''>>({});
  const [curriculum, setCurriculum] = useState<File | null>(null);
  const [errorCv, setErrorCv] = useState<string | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [trampa, setTrampa] = useState('');
  const [problema, setProblema] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const hoy = hoyEnCostaRica();

  useEffect(() => {
    document.title = 'Trabaje con nosotros · Municipalidad de Palmares';
    consultarFormularioPublico()
      .then(setFormulario)
      .catch((e) => setErrorDeCarga(textoDelError(e)));
  }, []);

  useEffect(() => setProblema(null), [datos, estudios, experiencias, habilidades, curriculum, acepta]);

  const poner = (campo: keyof Personales) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));

  function revisar(indice: number): string | null {
    if (indice === 0) {
      return (
        problemaDeCedula(datos.cedula) ??
        problemaDeNombres(datos) ??
        (!CORREO.test(datos.correo.trim()) ? 'Escriba un correo válido: es por donde Recursos Humanos lo contactará.' : null) ??
        (datos.telefono.trim() && !normalizarTelefono(datos.telefono) ? 'El teléfono debe ser un número de Costa Rica de 8 dígitos (por ejemplo 8712-4408).' : null) ??
        (problemaDeNacimiento(datos.fechaNacimiento, hoy) ? `Fecha de nacimiento: ${problemaDeNacimiento(datos.fechaNacimiento, hoy)}` : null)
      );
    }
    if (indice === 1) {
      if (!datos.profesionId && !datos.profesionTexto.trim()) return noEncuentroProfesion ? 'Escriba su profesión u oficio.' : 'Elija su profesión u oficio (o toque «No encuentro la mía»).';
      const i = estudios.findIndex((e) => !e.nivel);
      if (i >= 0) return `Estudio ${i + 1}: elija el nivel.`;
      const anio = estudios.findIndex((e) => e.anioFinalizacion && !/^(19[5-9]\d|20\d\d)$/.test(e.anioFinalizacion));
      if (anio >= 0) return `Estudio ${anio + 1}: el año debe tener 4 dígitos.`;
    }
    if (indice === 2) {
      for (const [i, e] of experiencias.entries()) {
        if (e.empresa.trim().length < 2) return `Experiencia ${i + 1}: escriba la empresa o institución.`;
        if (e.puesto.trim().length < 2) return `Experiencia ${i + 1}: escriba el puesto.`;
        if (!e.desde) return `Experiencia ${i + 1}: indique el mes en que empezó.`;
        if (e.desde > hoy.slice(0, 7)) return `Experiencia ${i + 1}: empieza en el futuro.`;
        if (!e.esActual && e.hasta && e.hasta < e.desde) return `Experiencia ${i + 1}: termina antes de empezar.`;
      }
    }
    if (indice === 4) {
      if (errorCv) return errorCv;
      if (!acepta) return 'Para registrarse debe leer y aceptar el consentimiento informado.';
    }
    return null;
  }

  function irA(destino: number) {
    if (destino > paso) {
      for (let i = paso; i < destino; i++) {
        const p = revisar(i);
        if (p) {
          setPaso(i);
          return setProblema(p);
        }
      }
    }
    setPaso(destino);
    setProblema(null);
    setTimeout(() => titulo.current?.focus(), 0);
  }

  async function enviar() {
    for (let i = 0; i < PASOS.length; i++) {
      const p = revisar(i);
      if (p) {
        setPaso(i);
        return setProblema(p);
      }
    }
    if (!formulario?.consentimiento) return;
    setEnviando(true);
    setProblema(null);
    const nulo = (t: string) => (t.trim() === '' ? null : t.trim());
    const cuerpo: RegistroDeCandidato = {
      cedula: datos.cedula.trim(),
      nombre: datos.nombre.trim(),
      primerApellido: datos.primerApellido.trim(),
      segundoApellido: nulo(datos.segundoApellido),
      correo: datos.correo.trim(),
      telefono: nulo(datos.telefono),
      fechaNacimiento: nulo(datos.fechaNacimiento),
      residencia: nulo(datos.residencia),
      profesionId: noEncuentroProfesion ? null : nulo(datos.profesionId),
      profesionTexto: noEncuentroProfesion ? nulo(datos.profesionTexto) : null,
      descripcion: nulo(datos.descripcion),
      formacion: estudios.map((e) => ({
        nivel: e.nivel as NivelEducativo,
        titulo: nulo(e.titulo),
        institucion: nulo(e.institucion),
        areaEstudio: null,
        anioFinalizacion: e.anioFinalizacion ? Number(e.anioFinalizacion) : null,
        concluido: e.concluido,
      })),
      experiencia: experiencias.map((e) => ({
        empresa: e.empresa.trim(),
        puesto: e.puesto.trim(),
        desde: nulo(e.desde),
        hasta: e.esActual ? null : nulo(e.hasta),
        esActual: e.esActual,
        descripcion: nulo(e.descripcion),
      })),
      habilidades: Object.entries(habilidades).map(([habilidadId, nivel]) => ({ habilidadId, nivel: nivel || null })),
      consentimientoId: formulario.consentimiento.id,
      aceptaConsentimiento: acepta,
      sitioWeb: trampa,
    };
    try {
      const r = await enviarRegistroPublico(cuerpo, curriculum);
      setEnviado(r.mensaje);
      window.scrollTo(0, 0);
    } catch (e) {
      setProblema(textoDelError(e));
    } finally {
      setEnviando(false);
    }
  }

  function empezarDeNuevo() {
    setDatos(VACIO);
    setEstudios([]);
    setExperiencias([]);
    setHabilidades({});
    setCurriculum(null);
    setAcepta(false);
    setNoEncuentroProfesion(false);
    setPaso(0);
    setEnviado(null);
  }

  if (enviado) {
    return (
      <Marco>
        <div className="card tp-listo" role="status">
          <span className="tp-listo-ico" aria-hidden="true">
            <Icono nombre="check" tamano={30} />
          </span>
          <h1>¡Gracias por registrarse!</h1>
          <p>{enviado}</p>
          <p className="ayuda-detalle">
            Sus datos solo los verá el Departamento de Recursos Humanos de la Municipalidad de Palmares. Si en algún momento quiere actualizarlos, vuelva a llenar el formulario con la
            misma cédula. Para pedir que se eliminen, comuníquese con Recursos Humanos.
          </p>
          <button type="button" className="btn btn-secundario" onClick={empezarDeNuevo}>
            Volver al formulario
          </button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="tp-intro">
        <h1>Trabaje con nosotros</h1>
        <p>
          Registre sus datos en la base de candidatos (Talent Pool) de la Municipalidad de Palmares. Cuando se abra una plaza que se ajuste a su perfil, Recursos Humanos podrá
          contactarlo.
        </p>
      </div>

      {errorDeCarga && <Mensaje tipo="error">{errorDeCarga}</Mensaje>}
      {!formulario && !errorDeCarga && <p className="ayuda-detalle">Cargando…</p>}
      {formulario && !formulario.consentimiento && <Mensaje tipo="info">El formulario no está disponible en este momento. Intente más tarde.</Mensaje>}

      {formulario?.consentimiento && (
        <>
          <Pasos pasos={PASOS} actual={paso} alElegir={irA} etiqueta="Pasos del registro" enPagina />
          <form
            className="card form-pasos"
            noValidate
            aria-label="Registro en el Talent Pool"
            onSubmit={(e) => {
              e.preventDefault();
              if (enviando) return;
              if (paso === PASOS.length - 1) void enviar();
              else irA(paso + 1);
            }}
          >
            <div className="panel-paso">
              <div className="barra-progreso" aria-hidden="true">
                <span style={{ width: `${Math.round(((paso + 1) / PASOS.length) * 100)}%` }} />
              </div>
              <h2 className="paso-titulo" ref={titulo} tabIndex={-1}>
                {PASOS[paso].titulo}
              </h2>
              <p className="paso-desc">{PASOS[paso].descripcion}</p>
              <div aria-live="assertive">{problema && <Mensaje tipo="error">{problema}</Mensaje>}</div>

              {paso === 0 && (
                <>
                  <div className="campo-fila">
                    <Texto id="tpCedula" etiqueta="Cédula" obligatorio valor={datos.cedula} alCambiar={poner('cedula')} max={25} placeholder="2-0678-0432" ayuda="Con o sin guiones. También DIMEX o pasaporte." />
                    <Texto id="tpNombre" etiqueta="Nombre" obligatorio valor={datos.nombre} alCambiar={poner('nombre')} max={50} />
                    <Texto id="tpAp1" etiqueta="Primer apellido" obligatorio valor={datos.primerApellido} alCambiar={poner('primerApellido')} max={40} />
                    <Texto id="tpAp2" etiqueta="Segundo apellido" valor={datos.segundoApellido} alCambiar={poner('segundoApellido')} max={40} />
                  </div>
                  <div className="campo-fila">
                    <Texto id="tpCorreo" etiqueta="Correo electrónico" obligatorio tipo="email" valor={datos.correo} alCambiar={poner('correo')} max={150} placeholder="nombre@ejemplo.com" />
                    <Texto
                      id="tpTel"
                      etiqueta="Teléfono"
                      tipo="tel"
                      valor={datos.telefono}
                      alCambiar={poner('telefono')}
                      max={20}
                      placeholder="8712-4408"
                      alSalir={() => {
                        const t = normalizarTelefono(datos.telefono);
                        if (t) poner('telefono')(t);
                      }}
                    />
                    <CampoFecha id="tpNac" etiqueta="Fecha de nacimiento" valor={datos.fechaNacimiento} alCambiar={poner('fechaNacimiento')} max={maximoDeNacimiento(hoy)} min="1920-01-01" error={problemaDeNacimiento(datos.fechaNacimiento, hoy)} />
                    <Texto id="tpRes" etiqueta="Lugar de residencia" valor={datos.residencia} alCambiar={poner('residencia')} max={150} placeholder="Cantón y distrito" />
                  </div>
                  <Mensaje tipo="info">
                    Por su privacidad, este formulario no muestra datos guardados. Si ya se había registrado con esta cédula, llénelo completo: al enviar, sus datos anteriores se
                    reemplazarán por estos.
                  </Mensaje>
                  {/* Campo trampa para robots: oculto a las personas y a los lectores de pantalla. */}
                  <div className="tp-trampa" aria-hidden="true">
                    <label htmlFor="tpSitio">Sitio web</label>
                    <input id="tpSitio" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
                  </div>
                </>
              )}

              {paso === 1 && (
                <>
                  <div className="campo-fila">
                    {!noEncuentroProfesion ? (
                      <div className="campo">
                        <label htmlFor="tpProf">
                          Profesión u oficio <span className="obligatorio">*</span>
                        </label>
                        <select id="tpProf" value={datos.profesionId} onChange={(e) => poner('profesionId')(e.target.value)}>
                          <option value="">Seleccione…</option>
                          {formulario.profesiones.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn-texto" onClick={() => { setNoEncuentroProfesion(true); poner('profesionId')(''); }}>
                          No encuentro la mía
                        </button>
                      </div>
                    ) : (
                      <div className="campo">
                        <label htmlFor="tpProfTxt">
                          Profesión u oficio <span className="obligatorio">*</span>
                        </label>
                        <input id="tpProfTxt" value={datos.profesionTexto} maxLength={150} onChange={(e) => poner('profesionTexto')(e.target.value)} placeholder="Por ejemplo: operador de maquinaria" />
                        <button type="button" className="btn-texto" onClick={() => { setNoEncuentroProfesion(false); poner('profesionTexto')(''); }}>
                          Elegir de la lista
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="campo">
                    <label htmlFor="tpDesc">Resumen profesional</label>
                    <textarea id="tpDesc" rows={3} maxLength={2000} value={datos.descripcion} onChange={(e) => poner('descripcion')(e.target.value)} placeholder="En pocas líneas: a qué se dedica y en qué le gustaría trabajar." />
                  </div>
                  <ListaEditable
                    titulo="Estudios"
                    vacio="Todavía no agregó estudios."
                    textoAgregar="Agregar estudio"
                    elementos={estudios}
                    alAgregar={() => setEstudios((l) => [...l, { nivel: '', titulo: '', institucion: '', anioFinalizacion: '', concluido: true }])}
                    alQuitar={(i) => setEstudios((l) => l.filter((_, j) => j !== i))}
                    maximo={10}
                    dibujar={(e, i) => {
                      const cambiar = (c: Partial<Estudio>) => setEstudios((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));
                      return (
                        <div className="campo-fila">
                          <div className="campo">
                            <label htmlFor={`tpNiv${i}`}>
                              Nivel <span className="obligatorio">*</span>
                            </label>
                            <select id={`tpNiv${i}`} value={e.nivel} onChange={(ev) => cambiar({ nivel: ev.target.value as NivelEducativo })}>
                              <option value="">Seleccione…</option>
                              {formulario.niveles.map((n) => (
                                <option key={n.valor} value={n.valor}>
                                  {n.texto}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Texto id={`tpTit${i}`} etiqueta="Título o nombre del curso" valor={e.titulo} alCambiar={(v) => cambiar({ titulo: v })} max={180} />
                          <Texto id={`tpIns${i}`} etiqueta="Institución" valor={e.institucion} alCambiar={(v) => cambiar({ institucion: v })} max={180} />
                          <Texto id={`tpAnio${i}`} etiqueta="Año" tipo="text" valor={e.anioFinalizacion} alCambiar={(v) => cambiar({ anioFinalizacion: v.replace(/\D/g, '').slice(0, 4) })} max={4} placeholder="2019" />
                          <label className="casilla tp-casilla">
                            <input type="checkbox" checked={!e.concluido} onChange={(ev) => cambiar({ concluido: !ev.target.checked })} /> En curso o sin terminar
                          </label>
                        </div>
                      );
                    }}
                  />
                </>
              )}

              {paso === 2 && (
                <ListaEditable
                  titulo="Experiencia laboral"
                  vacio="No agregó experiencia. Si no tiene, puede seguir."
                  textoAgregar="Agregar experiencia"
                  elementos={experiencias}
                  alAgregar={() => setExperiencias((l) => [...l, { empresa: '', puesto: '', desde: '', hasta: '', esActual: false, descripcion: '' }])}
                  alQuitar={(i) => setExperiencias((l) => l.filter((_, j) => j !== i))}
                  maximo={10}
                  dibujar={(e, i) => {
                    const cambiar = (c: Partial<Experiencia>) => setExperiencias((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));
                    return (
                      <>
                        <div className="campo-fila">
                          <Texto id={`tpEmp${i}`} etiqueta="Empresa o institución" obligatorio valor={e.empresa} alCambiar={(v) => cambiar({ empresa: v })} max={180} />
                          <Texto id={`tpPue${i}`} etiqueta="Puesto" obligatorio valor={e.puesto} alCambiar={(v) => cambiar({ puesto: v })} max={150} />
                          <div className="campo">
                            <label htmlFor={`tpDes${i}`}>
                              Desde <span className="obligatorio">*</span>
                            </label>
                            <input id={`tpDes${i}`} type="month" value={e.desde} max={hoy.slice(0, 7)} onChange={(ev) => cambiar({ desde: ev.target.value })} />
                          </div>
                          <div className="campo">
                            <label htmlFor={`tpHas${i}`}>Hasta</label>
                            <input id={`tpHas${i}`} type="month" value={e.esActual ? '' : e.hasta} disabled={e.esActual} min={e.desde || undefined} max={hoy.slice(0, 7)} onChange={(ev) => cambiar({ hasta: ev.target.value })} />
                            <label className="casilla tp-casilla">
                              <input type="checkbox" checked={e.esActual} onChange={(ev) => cambiar({ esActual: ev.target.checked })} /> Trabajo aquí actualmente
                            </label>
                          </div>
                        </div>
                        <div className="campo">
                          <label htmlFor={`tpFun${i}`}>Funciones principales</label>
                          <textarea id={`tpFun${i}`} rows={2} maxLength={500} value={e.descripcion} onChange={(ev) => cambiar({ descripcion: ev.target.value })} />
                        </div>
                      </>
                    );
                  }}
                />
              )}

              {paso === 3 && (
                <div className="tp-habilidades">
                  {(Object.keys(NOMBRE_DE_CATEGORIA) as CategoriaDeHabilidad[]).map((cat) => {
                    const deLaCategoria = formulario.habilidades.filter((h) => h.categoria === cat);
                    if (!deLaCategoria.length) return null;
                    return (
                      <fieldset key={cat}>
                        <legend>{NOMBRE_DE_CATEGORIA[cat]}</legend>
                        <div className="tp-chips">
                          {deLaCategoria.map((h) => {
                            const elegida = h.id in habilidades;
                            return (
                              <span key={h.id} className={elegida ? 'tp-chip elegida' : 'tp-chip'}>
                                <button
                                  type="button"
                                  aria-pressed={elegida}
                                  onClick={() =>
                                    setHabilidades((actual) => {
                                      const copia = { ...actual };
                                      if (elegida) delete copia[h.id];
                                      else copia[h.id] = '';
                                      return copia;
                                    })
                                  }
                                >
                                  {elegida && <Icono nombre="check" tamano={14} />} {h.nombre}
                                </button>
                                {elegida && (
                                  <select
                                    aria-label={`Nivel en ${h.nombre}`}
                                    value={habilidades[h.id]}
                                    onChange={(e) => setHabilidades((a) => ({ ...a, [h.id]: e.target.value as NivelDeHabilidad | '' }))}
                                  >
                                    <option value="">Nivel…</option>
                                    {(Object.keys(NOMBRE_DE_NIVEL_DE_HABILIDAD) as NivelDeHabilidad[]).map((n) => (
                                      <option key={n} value={n}>
                                        {NOMBRE_DE_NIVEL_DE_HABILIDAD[n]}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                  <p className="ayuda-detalle">{Object.keys(habilidades).length} elegidas.</p>
                </div>
              )}

              {paso === 4 && (
                <>
                  <div className="campo">
                    <label htmlFor="tpCv">
                      Currículum <small className="opcional">(opcional, PDF de hasta 10 MB)</small>
                    </label>
                    <ZonaDeArchivo
                      id="tpCv"
                      formatos={['pdf']}
                      tamanoMaximo={TAMANO_MAXIMO_CV}
                      archivo={curriculum}
                      invalido={Boolean(errorCv)}
                      alElegir={(a) => {
                        if (!a) return;
                        const p = problemaDeArchivo(a, ['pdf'], TAMANO_MAXIMO_CV);
                        setErrorCv(p);
                        setCurriculum(p ? null : a);
                      }}
                      alQuitar={() => {
                        setCurriculum(null);
                        setErrorCv(null);
                      }}
                    />
                    {errorCv && <span className="msg-error" role="alert">{errorCv}</span>}
                  </div>
                  <div className="tp-consentimiento" tabIndex={0} aria-label="Texto del consentimiento informado">
                    {formulario.consentimiento.texto.split(/\n{2,}/).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  <label className="casilla tp-acepto">
                    <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
                    <span>
                      He leído y acepto el consentimiento informado. <span className="obligatorio">*</span>
                    </span>
                  </label>
                  <small className="ayuda-detalle tp-version">Versión {formulario.consentimiento.version}</small>
                  <Mensaje tipo="advert">Al enviar, si ya existía un registro con la cédula {datos.cedula || 'indicada'}, se reemplazará completo por este.</Mensaje>
                </>
              )}
            </div>

            <div className="pie-form">
              <span className="contador-paso">
                Paso <b>{paso + 1}</b> de {PASOS.length}
              </span>
              <div className="der">
                {paso > 0 && (
                  <button className="btn btn-secundario" type="button" onClick={() => irA(paso - 1)} disabled={enviando}>
                    Anterior
                  </button>
                )}
                <button className="btn btn-primario" type="submit" disabled={enviando} aria-busy={enviando || undefined}>
                  {paso === PASOS.length - 1 ? (enviando ? 'Enviando…' : 'Enviar mis datos') : 'Siguiente'}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </Marco>
  );
}

/** Lista de bloques que se agregan y quitan (estudios, experiencias). */
function ListaEditable<T>({
  titulo,
  vacio,
  textoAgregar,
  elementos,
  alAgregar,
  alQuitar,
  maximo,
  dibujar,
}: {
  titulo: string;
  vacio: string;
  textoAgregar: string;
  elementos: T[];
  alAgregar: () => void;
  alQuitar: (i: number) => void;
  maximo: number;
  dibujar: (e: T, i: number) => ReactNode;
}) {
  return (
    <div className="tp-lista">
      <h3>{titulo}</h3>
      {elementos.length === 0 && <p className="ayuda-detalle">{vacio}</p>}
      {elementos.map((e, i) => (
        <div className="tp-bloque" key={i}>
          <div className="tp-bloque-cab">
            <b>
              {titulo.split(' ')[0].replace(/s$/, '')} {i + 1}
            </b>
            <button type="button" className="btn-texto btn-texto-peligro" onClick={() => alQuitar(i)} aria-label={`Quitar ${titulo.toLowerCase()} ${i + 1}`}>
              <Icono nombre="basura" tamano={14} /> Quitar
            </button>
          </div>
          {dibujar(e, i)}
        </div>
      ))}
      {elementos.length < maximo && (
        <button type="button" className="btn btn-secundario btn-chico" onClick={alAgregar}>
          <Icono nombre="mas" tamano={15} /> {textoAgregar}
        </button>
      )}
    </div>
  );
}

/** Marco de la pagina publica: barra con la marca, sin menu (no hay sesion). */
function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="tp-publico">
      <header className="tp-barra">
        <span className="tp-marca">
          <img src={simboloSinergia} alt="" />
          <span>
            <b>Municipalidad de Palmares</b>
            <small>Recursos Humanos · Talent Pool</small>
          </span>
        </span>
        <BotonTema clase="btn-icono-claro" />
      </header>
      <main className="tp-contenido">{children}</main>
      <footer className="tp-pie">
        <img className="logo-claro" src={logoClaro} alt="Municipalidad de Palmares" />
        <img className="logo-oscuro" src={logoOscuro} alt="" />
        <span>
          ¿Es funcionario? <Link to="/iniciar-sesion">Ingrese a SINERGIA</Link>
        </span>
      </footer>
    </div>
  );
}
