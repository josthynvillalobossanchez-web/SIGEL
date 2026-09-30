/*
 * Expediente laboral (pgExpediente del prototipo). Dos rutas:
 *   /funcionarios/:id/expediente  Recursos Humanos abre el de cualquiera
 *                                 (o cualquiera el suyo); con migas.
 *   /mi-expediente                 cada persona el suyo (menu "Mi acceso").
 *
 * Quien lo abre (decision de Josthyn, 28/09): cada persona el SUYO, solo para
 * ver; el de otra persona, solo Recursos Humanos (expediente.verTodos). El
 * backend lo vuelve a revisar (EXPEDIENTE_AJENO) y anota cada apertura en la
 * bitacora (T-4), por eso se pide UNA sola vez al entrar.
 *
 * Arriba, la tarjeta de perfil con el degradado (misma del prototipo) y el
 * aviso de informacion sensible. Debajo, pestanas (?pestana=historial):
 *   Informacion personal · Informacion laboral · Documentos ·
 *   Capacitaciones · Historial laboral
 * Documentos llega con la gestion documental (epica 3) y Capacitaciones en
 * el Sprint 2: por ahora muestran su explicacion.
 */
import { useNavigate, useParams } from 'react-router';
import { useConsulta } from '../../utilidades/useConsulta';
import { abrirExpediente } from '../../api/expedientes';
import { NOMBRES_DE_NOMBRAMIENTO, nombreDeRegimen } from '../../api/funcionarios';
import { BotonConAyuda } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Migas } from '../../componentes/Migas';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { TarjetaDePerfil } from '../../componentes/TarjetaDePerfil';
import { useSesion } from '../../sesion/SesionProveedor';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { inicialesDeFuncionario, nombreCompleto } from '../../utilidades/texto';
import { ChipDeFuncionario } from '../funcionarios/ChipDeFuncionario';
import { DatosLaboralesVista, DatosPersonalesVista } from '../funcionarios/DatosDeFuncionario';
import { motivoParaEditar } from '../funcionarios/motivos';
import { HistorialLaboral } from './HistorialLaboral';

const PESTANAS = [
  { id: 'personal', texto: 'Información personal' },
  { id: 'laboral', texto: 'Información laboral' },
  { id: 'documentos', texto: 'Documentos' },
  { id: 'capacitaciones', texto: 'Capacitaciones' },
  { id: 'historial', texto: 'Historial laboral' },
];

/** /funcionarios/:id/expediente */
export function PaginaExpediente() {
  const { id } = useParams();
  return <VistaDeExpediente funcionarioId={id} />;
}

/** /mi-expediente */
export function PaginaMiExpediente() {
  return <VistaDeExpediente />;
}

function VistaDeExpediente({ funcionarioId }: { funcionarioId?: string }) {
  const { tienePermisos } = useSesion();
  const navegar = useNavigate();
  const [parametros, cambiar] = useParametrosEnUrl();
  const pedida = parametros.get('pestana');
  const pestana = PESTANAS.some((p) => p.id === pedida) ? pedida! : 'personal';

  // Abrir el expediente queda en la bitacora: se pide una sola vez por persona.
  const { datos: expediente, error } = useConsulta(() => abrirExpediente(funcionarioId), [funcionarioId]);

  const f = expediente?.funcionario;
  const desdeFuncionarios = funcionarioId !== undefined;
  const migas = desdeFuncionarios
    ? [
        { texto: 'Funcionarios', a: '/funcionarios' },
        f ? { texto: nombreCompleto(f), a: `/funcionarios?ver=${f.id}` } : { texto: '…' },
        { texto: 'Expediente laboral' },
      ]
    : null;

  if (error) {
    return (
      <section className="pagina pagina-expediente">
        {migas && <Migas migas={migas} />}
        <Mensaje tipo="error">{error}</Mensaje>
      </section>
    );
  }
  if (!expediente || !f) {
    return (
      <section className="pagina pagina-expediente">
        {migas && <Migas migas={migas} />}
        <p style={{ color: 'var(--texto-sec)' }}>Abriendo el expediente…</p>
      </section>
    );
  }

  const propio = expediente.esPropio;
  const deQuien = propio ? 'su' : 'el';

  return (
    <section className="pagina pagina-expediente">
      {migas && <Migas migas={migas} />}

      {/* ---------------- Perfil del funcionario ---------------- */}
      <TarjetaDePerfil
        etiqueta="Datos del funcionario"
        iniciales={inicialesDeFuncionario(f)}
        titulo={nombreCompleto(f)}
        identificacion={`Cédula ${f.cedula}`}
        chips={
          <>
            <ChipDeFuncionario estado={f.estado} />
            <span className="chip chip-neutro">{NOMBRES_DE_NOMBRAMIENTO[f.tipoNombramiento]}</span>
            <span className="chip chip-info">Régimen {nombreDeRegimen(f.regimenVacaciones.nombre).toLowerCase()}</span>
          </>
        }
        acciones={
          <>
            {propio ? (
              <BotonConAyuda
                icono="editar"
                texto="Editar mis datos"
                ayuda="Sus datos personales (y los laborales, si es de Recursos Humanos) se cambian en Mi cuenta"
                alHacerClic={() => navegar('/mi-cuenta')}
              />
            ) : (
              tienePermisos('funcionarios.editar') && (
                <BotonConAyuda
                  icono="editar"
                  texto="Editar funcionario"
                  ayuda="Corregir sus datos personales o laborales (se abre la página de edición)"
                  bloqueadoPor={motivoParaEditar(f, tienePermisos)}
                  alHacerClic={() => navegar(`/funcionarios/${f.id}/editar`)}
                />
              )
            )}
            {/* Enlace entre modulos: de la persona a su cuenta de acceso. */}
            {!propio && tienePermisos('usuarios.ver') && (
              <BotonConAyuda
                icono="usuarios"
                texto="Ver su cuenta"
                ayuda="Abrir su cuenta de acceso en Usuarios (roles, estado, permisos)"
                bloqueadoPor={f.cuenta ? null : 'no tiene cuenta de acceso. Se le puede crear desde Usuarios → «Crear usuario».'}
                alHacerClic={() => f.cuenta && navegar(`/usuarios?ver=${f.cuenta.id}`)}
              />
            )}
            <BotonConAyuda
              clase="btn btn-primario"
              icono="mas"
              texto="Subir documento"
              bloqueadoPor="la carga de documentos llega con la gestión documental (épica 3)."
            />
          </>
        }
      />

      <div className="aviso" style={{ marginTop: 12 }}>
        <Icono nombre="candado" />
        <p>
          <b>Expediente con información sensible.</b> Cada apertura queda registrada en la bitácora, con usuario y fecha.
          {propio ? ' Es su expediente: aquí solo se consulta.' : ''}
        </p>
      </div>

      <Pestanas
        prefijo="exp"
        etiqueta="Secciones del expediente"
        actual={pestana}
        alCambiar={(id) => cambiar({ pestana: id === 'personal' ? '' : id })}
        opciones={PESTANAS}
      />

      <PanelDePestana id="personal" actual={pestana} prefijo="exp">
        <div className="card">
          <DatosPersonalesVista f={f} />
        </div>
        <p className="nota-pagina">
          {propio
            ? 'Usted mantiene estos datos desde «Mi cuenta» (la cédula la corrige Recursos Humanos).'
            : 'La persona los mantiene desde «Mi cuenta». Recursos Humanos los corrige con «Editar funcionario».'}
        </p>
      </PanelDePestana>

      <PanelDePestana id="laboral" actual={pestana} prefijo="exp">
        {/* Solo la modifica Recursos Humanos; cada cambio queda en el Historial laboral. */}
        <div className="card">
          <DatosLaboralesVista f={f} />
        </div>
      </PanelDePestana>

      <PanelDePestana id="documentos" actual={pestana} prefijo="exp">
        <div className="vacio">
          <Icono nombre="carpeta" tamano={36} />
          <h3>Los documentos llegan con la gestión documental</h3>
          <p>
            Aquí se verán los documentos de {deQuien} expediente. Cada persona podrá subir documentos a su propio
            expediente y dar de baja solo los que ella misma subió; Recursos Humanos puede dar de baja cualquiera. Nada
            se borra: se da de baja y se puede restaurar.
          </p>
        </div>
      </PanelDePestana>

      <PanelDePestana id="capacitaciones" actual={pestana} prefijo="exp">
        <div className="vacio">
          <Icono nombre="reloj" tamano={36} />
          <h3>Sin capacitaciones registradas</h3>
          <p>Las capacitaciones llegan en el Sprint 2. Aparecerán aquí, junto con su certificado si se adjunta al finalizar.</p>
        </div>
      </PanelDePestana>

      <PanelDePestana id="historial" actual={pestana} prefijo="exp">
        {pestana === 'historial' && <HistorialLaboral funcionarioId={f.id} />}
      </PanelDePestana>
    </section>
  );
}
