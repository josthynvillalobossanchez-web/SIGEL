/*
 * Los pasos de "Registrar / Editar funcionario" (PaginaFuncionario.tsx),
 * cada uno en su componente para que la pagina quede corta:
 *
 *   PasoDatosPersonales · PasoContacto · PasoDatosLaborales · PasoCuenta
 *   RevisarRegistro (al registrar) · RevisarCambios (al editar)
 *
 * Solo dibujan: los datos, la revision de cada paso y el guardado viven en
 * la pagina. Reciben "datos" (el formulario) y "poner(campo)(valor)".
 */
import type { ReactNode } from 'react';
import {
  NOMBRES_DE_NOMBRAMIENTO,
  nombreDeRegimen,
  type DatosDeFuncionario,
  type DetalleDeFuncionario,
  type OpcionesDeFormulario,
  type TipoDeNombramiento,
} from '../../api/funcionarios';
import type { RolResumido } from '../../api/roles';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Lista, Texto } from '../../componentes/CamposDeFormulario';
import { Mensaje } from '../../componentes/Mensaje';
import { formatearFechaSola } from '../../utilidades/fechas';
import { nombreCompleto, normalizarCedula } from '../../utilidades/texto';
import {
  LARGO_APELLIDO,
  LARGO_NOMBRE,
  maximoDeIngreso,
  maximoDeNacimiento,
  normalizarTelefono,
} from '../../utilidades/validaciones';
import { SelectorDeRoles, type RolesMarcados } from '../usuarios/SelectorDeRoles';
import { opcionesDeJefatura, type listasConActuales } from './listasDeFormulario';

/** El formulario: todos los campos como texto (vacio = sin dato). */
export type Formulario = Record<keyof DatosDeFuncionario, string>;
type Poner = (campo: keyof Formulario) => (valor: string) => void;
type Listas = ReturnType<typeof listasConActuales>;

/* ---------------- 1. Datos personales ---------------- */

export function PasoDatosPersonales({
  datos,
  poner,
  editando,
  listas,
  opciones,
  errorNacimiento,
  hoy,
}: {
  datos: Formulario;
  poner: Poner;
  editando: boolean;
  listas: Listas;
  opciones: OpcionesDeFormulario;
  errorNacimiento: string | null;
  hoy: string;
}) {
  return (

        <div className="campo-fila">
          <div className="campo">
            <label htmlFor="fnCedula">Cédula {!editando && <span className="obligatorio">*</span>}</label>
            <input
              id="fnCedula"
              value={datos.cedula}
              onChange={(e) => poner('cedula')(e.target.value)}
              placeholder="2-0678-0432"
              maxLength={25}
              readOnly={editando}
              aria-readonly={editando || undefined}
              aria-required={!editando || undefined}
              style={{ fontVariantNumeric: 'tabular-nums' }}
              autoComplete="off"
            />
            <span className="ayuda">{editando ? 'No se puede cambiar.' : 'Con o sin guiones. También DIMEX o pasaporte.'}</span>
          </div>
          <Texto id="fnNombre" etiqueta="Nombre" obligatorio valor={datos.nombre} alCambiar={poner('nombre')} max={LARGO_NOMBRE} />
          <Texto id="fnAp1" etiqueta="Primer apellido" obligatorio valor={datos.primerApellido} alCambiar={poner('primerApellido')} max={LARGO_APELLIDO} />
          <Texto id="fnAp2" etiqueta="Segundo apellido" valor={datos.segundoApellido} alCambiar={poner('segundoApellido')} max={LARGO_APELLIDO} />
          <CampoFecha
            id="fnNac"
            etiqueta="Fecha de nacimiento"
            valor={datos.fechaNacimiento}
            alCambiar={poner('fechaNacimiento')}
            max={maximoDeNacimiento(hoy)}
            min="1900-01-01"
            error={errorNacimiento}
          />
          <Lista
            id="fnProf"
            etiqueta="Profesión"
            valor={datos.profesionId}
            alCambiar={poner('profesionId')}
            opciones={listas.profesiones}
            vacio="Sin profesión"
            ayuda={opciones.profesiones.length === 0 ? 'Todavía no hay profesiones: se agregan en Catálogos de personal.' : undefined}
          />
        </div>
  );
}

/* ---------------- 2. Contacto ---------------- */

export function PasoContacto({ datos, poner, editando, detalle }: { datos: Formulario; poner: Poner; editando: boolean; detalle?: DetalleDeFuncionario }) {
  return (

        <>
          <div className="campo-fila">
            <Texto
              id="fnCorreoP"
              etiqueta="Correo personal"
              obligatorio
              tipo="email"
              valor={datos.correoPersonal}
              alCambiar={poner('correoPersonal')}
              max={150}
              ayuda="Obligatorio: es el canal de respaldo si no tiene correo institucional."
            />
            <Texto
              id="fnCorreoI"
              etiqueta="Correo institucional"
              tipo="email"
              valor={datos.correoInstitucional}
              alCambiar={poner('correoInstitucional')}
              max={150}
              placeholder="nombre@munipalmares.go.cr"
              ayuda={editando && detalle?.cuenta ? `No cambia el correo con el que inicia sesión (${detalle.cuenta.correo}).` : 'Si tiene, es el correo con el que iniciará sesión.'}
            />
            <Texto
              id="fnTel"
              etiqueta="Teléfono"
              tipo="tel"
              valor={datos.telefonoPersonal}
              alCambiar={poner('telefonoPersonal')}
              max={16}
              placeholder="8712-4408"
              ayuda="8 dígitos de Costa Rica. Se guarda como 8712-4408."
              alSalir={() => {
                const normal = normalizarTelefono(datos.telefonoPersonal);
                if (normal) poner('telefonoPersonal')(normal);
              }}
            />
          </div>
          <div className="campo ancho">
            <label htmlFor="fnDir">Dirección exacta</label>
            <textarea
              id="fnDir"
              rows={2}
              maxLength={255}
              value={datos.direccion}
              onChange={(e) => poner('direccion')(e.target.value)}
              placeholder="Provincia, cantón, distrito y señas exactas"
            />
          </div>
        </>
  );
}

/* ---------------- 3. Datos laborales ---------------- */

export function PasoDatosLaborales({
  datos,
  poner,
  listas,
  opciones,
  minimoIngreso,
  errorIngreso,
  hoy,
}: {
  datos: Formulario;
  poner: Poner;
  listas: Listas;
  opciones: OpcionesDeFormulario;
  minimoIngreso: string;
  errorIngreso: string | null;
  hoy: string;
}) {
  return (

        <>
          <Mensaje tipo="info">
            Solo Recursos Humanos registra o modifica estos campos. El funcionario nunca los edita, ni desde su propio perfil.
          </Mensaje>
          <div className="campo-fila">
            <Lista
              id="fnPuesto"
              etiqueta="Puesto"
              obligatorio
              valor={datos.puestoId}
              alCambiar={poner('puestoId')}
              opciones={listas.puestos}
              ayuda={opciones.puestos.length === 0 ? 'Todavía no hay puestos: se agregan en Catálogos de personal.' : undefined}
            />
            <Lista
              id="fnDepto"
              etiqueta="Departamento"
              obligatorio
              valor={datos.departamentoId}
              alCambiar={poner('departamentoId')}
              opciones={listas.departamentos}
              ayuda={opciones.departamentos.length === 0 ? 'Todavía no hay departamentos: se agregan en Catálogos de personal.' : undefined}
            />
            <Lista
              id="fnJefe"
              etiqueta="Jefatura inmediata"
              valor={datos.jefaturaId}
              alCambiar={poner('jefaturaId')}
              opciones={opcionesDeJefatura(listas.jefaturas)}
              vacio="— Sin jefatura: tope de la jerarquía —"
              ayuda={
                listas.jefaturas.length === 0
                  ? 'Todavía nadie puede ser jefatura: se necesita una cuenta con el rol Aprobador permanente (se asigna en Usuarios).'
                  : 'Solo aparecen quienes tienen el rol Aprobador permanente (las suplencias con fecha no cuentan).'
              }
            />
            <div className="campo">
              <label htmlFor="fnNombramiento">
                Tipo de nombramiento <span className="obligatorio">*</span>
              </label>
              <select id="fnNombramiento" value={datos.tipoNombramiento} onChange={(e) => poner('tipoNombramiento')(e.target.value)} aria-required="true">
                {opciones.tiposNombramiento.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </div>
            <Lista
              id="fnRegimen"
              etiqueta="Régimen de vacaciones"
              obligatorio
              valor={datos.regimenVacacionesId}
              alCambiar={poner('regimenVacacionesId')}
              opciones={listas.regimenes.map((r) => ({ id: r.id, nombre: `${nombreDeRegimen(r.nombre)}${r.descripcion ? ` — ${r.descripcion}` : ''}` }))}
            />
            <CampoFecha
              id="fnIngreso"
              etiqueta="Fecha de ingreso"
              obligatorio
              valor={datos.fechaIngreso}
              alCambiar={poner('fechaIngreso')}
              min={minimoIngreso}
              max={maximoDeIngreso(hoy)}
              error={errorIngreso}
            />
            <Texto
              id="fnCodigo"
              etiqueta="Código de empleado"
              valor={datos.numeroEmpleado}
              alCambiar={poner('numeroEmpleado')}
              max={30}
              ayuda="Opcional. No se repite."
            />
          </div>
        </>
  );
}

/* ---------------- 4. Cuenta de acceso (solo al registrar) ---------------- */

export function PasoCuenta({
  datos,
  crearCuenta,
  bloqueoCuenta,
  alAlternar,
  roles,
  marcados,
  alCambiarRoles,
}: {
  datos: Formulario;
  crearCuenta: boolean;
  /** Por que no se puede crear la cuenta aqui (null = si se puede). */
  bloqueoCuenta: string | null;
  alAlternar: () => void;
  roles: RolResumido[] | null;
  marcados: RolesMarcados;
  alCambiarRoles: (marcados: RolesMarcados) => void;
}) {
  return (

        <>
          <label className="check casilla-grande" data-bloqueado={bloqueoCuenta ? 'si' : 'no'} data-ayuda={bloqueoCuenta ?? undefined}>
            <input type="checkbox" checked={crearCuenta} onChange={alAlternar} aria-disabled={bloqueoCuenta ? true : undefined} aria-describedby="cuentaDesc" />
            <span className="txt">
              <b>Crear también su cuenta de acceso</b>
              <span id="cuentaDesc">
                {bloqueoCuenta
                  ? `No disponible: ${bloqueoCuenta}`
                  : `Correo de ingreso: ${datos.correoInstitucional.trim().toLowerCase()}. La contraseña temporal la genera el sistema, se muestra una sola vez y se envía por correo.`}
              </span>
            </span>
          </label>
          {crearCuenta && <SelectorDeRoles roles={roles} iniciales={{}} marcados={marcados} alCambiar={alCambiarRoles} />}
          {!crearCuenta && !bloqueoCuenta && (
            <p className="nota-modal" style={{ marginTop: 12 }}>
              Si no la crea ahora, se puede crear después desde Usuarios → Crear usuario.
            </p>
          )}
        </>
  );
}

/* ---------------- Revisar ---------------- */

/** Al registrar: todo lo que se va a guardar, en dos bloques. */
export function RevisarRegistro({
  datos,
  listas,
  crearCuenta,
  marcados,
  roles,
}: {
  datos: Formulario;
  listas: Listas;
  crearCuenta: boolean;
  marcados: RolesMarcados;
  roles: RolResumido[] | null;
}) {
  const textoDe = (campo: keyof Formulario, valor: string) => textoDeCampo(campo, valor, listas);
  const nombre = nombreCompleto({ nombre: datos.nombre || '—', primerApellido: datos.primerApellido, segundoApellido: datos.segundoApellido || null });
  return (

        <div className="revisar-bloques">
          <Bloque titulo="Persona">
            <DatoRevisar t="Nombre completo" v={nombre} />
            <DatoRevisar t="Cédula" v={normalizarCedula(datos.cedula)} />
            <DatoRevisar t="Nacimiento" v={textoDe('fechaNacimiento', datos.fechaNacimiento)} />
            <DatoRevisar t="Profesión" v={textoDe('profesionId', datos.profesionId)} />
            <DatoRevisar t="Correo personal" v={datos.correoPersonal.trim().toLowerCase()} />
            <DatoRevisar t="Correo institucional" v={datos.correoInstitucional.trim().toLowerCase() || '—'} />
            <DatoRevisar t="Teléfono" v={normalizarTelefono(datos.telefonoPersonal) ?? (datos.telefonoPersonal || '—')} />
            <DatoRevisar t="Dirección" v={datos.direccion || '—'} />
          </Bloque>
          <Bloque titulo="Trabajo y acceso">
            <DatoRevisar t="Puesto" v={textoDe('puestoId', datos.puestoId)} />
            <DatoRevisar t="Departamento" v={textoDe('departamentoId', datos.departamentoId)} />
            <DatoRevisar t="Jefatura" v={textoDe('jefaturaId', datos.jefaturaId)} />
            <DatoRevisar t="Nombramiento" v={textoDe('tipoNombramiento', datos.tipoNombramiento)} />
            <DatoRevisar t="Régimen" v={textoDe('regimenVacacionesId', datos.regimenVacacionesId)} />
            <DatoRevisar t="Ingreso" v={textoDe('fechaIngreso', datos.fechaIngreso)} />
            <DatoRevisar t="Código de empleado" v={datos.numeroEmpleado || '—'} />
            <DatoRevisar
              t="Cuenta de acceso"
              v={
                crearCuenta
                  ? `${datos.correoInstitucional.trim().toLowerCase()} · ${Object.keys(marcados)
                      .map((id) => roles?.find((r) => r.id === id)?.nombre)
                      .join(', ')}`
                  : 'No se crea ahora'
              }
            />
          </Bloque>
        </div>
  );
}

/** Al editar: tabla de lo que cambia (antes / despues). */
export function RevisarCambios({
  cambios,
  inicial,
  datos,
  listas,
}: {
  cambios: (keyof Formulario)[];
  inicial: Formulario;
  datos: Formulario;
  listas: Listas;
}) {
  const textoDe = (campo: keyof Formulario, valor: string) => textoDeCampo(campo, valor, listas);
  return (

        cambios.length === 0 ? (
          <Mensaje tipo="info">Todavía no hay cambios. Vaya a cualquier paso para modificar algo.</Mensaje>
        ) : (
          <div className="tabla-envoltura tabla-compacta">
            <table>
              <caption className="solo-lector">Cambios que se van a guardar</caption>
              <thead>
                <tr>
                  <th scope="col">Dato</th>
                  <th scope="col">Antes</th>
                  <th scope="col">Después</th>
                </tr>
              </thead>
              <tbody>
                {cambios.map((c) => (
                  <tr key={c}>
                    <td data-etiqueta="Dato">{ETIQUETAS[c]}</td>
                    <td data-etiqueta="Antes">{textoDe(c, inicial[c].trim())}</td>
                    <td data-etiqueta="Después">
                      <b>{textoDe(c, datos[c].trim())}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
  );
}

/* ---------------- Textos ---------------- */

/** Como se lee un valor del formulario (el nombre del puesto, no su id). */
export function textoDeCampo(campo: keyof Formulario, valor: string, listas: Listas): string {
  const nombreDe = (lista: { id: string; nombre: string }[], id: string) => lista.find((x) => x.id === id)?.nombre ?? '';

  if (!valor) return campo === 'jefaturaId' ? 'Sin jefatura (tope de la jerarquía)' : '—';
  switch (campo) {
    case 'puestoId':
      return nombreDe(listas.puestos, valor);
    case 'departamentoId':
      return nombreDe(listas.departamentos, valor);
    case 'profesionId':
      return nombreDe(listas.profesiones, valor);
    case 'regimenVacacionesId':
      return nombreDeRegimen(nombreDe(listas.regimenes, valor));
    case 'jefaturaId':
      return nombreDe(listas.jefaturas, valor);
    case 'tipoNombramiento':
      return NOMBRES_DE_NOMBRAMIENTO[valor as TipoDeNombramiento];
    case 'fechaNacimiento':
    case 'fechaIngreso':
      return formatearFechaSola(valor);
    default:
      return valor;
  }
}

/** Nombre de cada campo en la tabla de cambios. */
const ETIQUETAS: Record<keyof Formulario, string> = {
  cedula: 'Cédula',
  nombre: 'Nombre',
  primerApellido: 'Primer apellido',
  segundoApellido: 'Segundo apellido',
  fechaNacimiento: 'Fecha de nacimiento',
  profesionId: 'Profesión',
  correoPersonal: 'Correo personal',
  correoInstitucional: 'Correo institucional',
  telefonoPersonal: 'Teléfono',
  direccion: 'Dirección',
  puestoId: 'Puesto',
  departamentoId: 'Departamento',
  jefaturaId: 'Jefatura inmediata',
  tipoNombramiento: 'Tipo de nombramiento',
  regimenVacacionesId: 'Régimen de vacaciones',
  fechaIngreso: 'Fecha de ingreso',
  numeroEmpleado: 'Código de empleado',
};

/* ------------------------------------------------------------------ */
/* Piezas pequenas del formulario                                      */
/* ------------------------------------------------------------------ */

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="info-bloque">
      <h3>{titulo}</h3>
      <dl className="info-rejilla">{children}</dl>
    </section>
  );
}

function DatoRevisar({ t, v }: { t: string; v: string }) {
  return (
    <div className="dato">
      <dt>{t}</dt>
      <dd>{v}</dd>
    </div>
  );
}
