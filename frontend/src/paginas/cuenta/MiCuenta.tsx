/*
 * Pagina "Mi cuenta" (seccion pgCuenta del prototipo).
 *
 * Arriba, la tarjeta de perfil (TarjetaDePerfil): fotografia o iniciales,
 * nombre, cedula y correo, estado y roles, y los datos rapidos (puesto,
 * departamento, ingreso, ultimo acceso). Debajo, tres pestanas centradas:
 *   - Mis datos personales (FormularioPersonalPropio): con
 *     perfilPropio.editar se cambia todo menos la cedula; sin el permiso,
 *     solo se ve.
 *   - Datos laborales: todos los ven; solo Recursos Humanos
 *     (funcionarios.editar) los cambia, tambien los suyos
 *     (FormularioLaboralPropio).
 *   - Acceso y seguridad (AccesoYSeguridad): datos de acceso, roles y
 *     cambio de contrasena.
 *
 * Las vistas de solo lectura son las mismas de Funcionarios, Usuarios y el
 * expediente (paginas/funcionarios/DatosDeFuncionario.tsx). Todo es sobre la
 * persona conectada: el backend toma su id de la sesion.
 */
import { useState, type ReactNode } from 'react';
import { consultarMiCuenta } from '../../api/miCuenta';
import { BotonConAyuda } from '../../componentes/Botones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { TarjetaDePerfil } from '../../componentes/TarjetaDePerfil';
import { formatearFechaHora, formatearFechaSola } from '../../utilidades/fechas';
import { inicialesDeFuncionario, inicialesDesdeCorreo, nombreCompleto } from '../../utilidades/texto';
import { useConsulta } from '../../utilidades/useConsulta';
import { DatosLaboralesVista, DatosPersonalesVista } from '../funcionarios/DatosDeFuncionario';
import { ChipDeEstadoDeCuenta } from '../usuarios/ChipDeEstadoDeCuenta';
import { AccesoYSeguridad } from './AccesoYSeguridad';
import { FormularioLaboralPropio } from './FormularioLaboralPropio';
import { FormularioPersonalPropio } from './FormularioPersonalPropio';

export function MiCuenta() {
  const { datos: perfil, error, cambiarDatos: setPerfil } = useConsulta(consultarMiCuenta, []);
  const [pestana, setPestana] = useState('datos');
  const [aviso, setAviso] = useState<string | null>(null);

  if (error && !perfil) return <Mensaje tipo="error">{error}</Mensaje>;
  if (!perfil) return <p style={{ color: 'var(--texto-sec)' }}>Cargando su cuenta…</p>;

  const f = perfil.funcionario;

  return (
    <section className="pagina">
      <TarjetaDePerfil
        etiqueta="Mi perfil"
        iniciales={f ? inicialesDeFuncionario(f) : inicialesDesdeCorreo(perfil.cuenta.correo)}
        extraDeFoto={
          <>
            <span className="solo-lector">{f ? 'Sin fotografía: se muestran sus iniciales.' : 'Cuenta técnica sin fotografía.'}</span>
            <BotonConAyuda
              clase="cambiar"
              texto="Cambiar mi fotografía"
              bloqueadoPor="la carga de la fotografía se habilita con la gestión documental (épica 3)."
            >
              <Icono nombre="camara" tamano={16} />
            </BotonConAyuda>
          </>
        }
        titulo={f ? nombreCompleto(f) : 'Cuenta técnica de Informática'}
        identificacion={`${f ? `Cédula ${f.cedula} · ` : ''}${perfil.cuenta.correo}`}
        chips={
          <>
            <ChipDeEstadoDeCuenta cuenta={{ estado: perfil.cuenta.estado, bloqueadoHasta: null, debeCambiarContrasena: false }} />
            {perfil.cuenta.roles.map((rol) => (
              <span className="chip-rol sistema" key={rol}>
                {rol}
              </span>
            ))}
          </>
        }
        rapidos={[
          { titulo: 'Puesto', valor: f?.puesto?.nombre ?? '—' },
          { titulo: 'Departamento', valor: f?.departamento?.nombre ?? '—' },
          { titulo: 'Ingreso', valor: f ? formatearFechaSola(f.fechaIngreso) : '—', num: true },
          { titulo: 'Último acceso', valor: formatearFechaHora(perfil.cuenta.ultimoAcceso), num: true },
        ]}
      />

      {/* Pestanas y su contenido, centrados con el mismo ancho de siempre. */}
      <div className="mc-centro">
        <Pestanas
          prefijo="mc"
          etiqueta="Secciones de mi cuenta"
          actual={pestana}
          alCambiar={(id) => {
            setAviso(null);
            setPestana(id);
          }}
          opciones={[
            { id: 'datos', texto: 'Mis datos personales' },
            { id: 'laborales', texto: 'Datos laborales' },
            { id: 'acceso', texto: 'Acceso y seguridad' },
          ]}
        />
        <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>

        <PanelDePestana id="datos" actual={pestana} prefijo="mc">
          {!f ? (
            <SinFuncionario />
          ) : perfil.puedeEditarDatos ? (
            <FormularioPersonalPropio
              perfil={perfil}
              f={f}
              alEditar={() => setAviso(null)}
              alGuardar={(nuevo) => {
                setPerfil(nuevo);
                setAviso('Sus datos personales se guardaron. El cambio quedó registrado en la bitácora.');
              }}
            />
          ) : (
            <SoloLectura nota="Su cuenta no tiene permiso para cambiar sus datos personales. Si algo no está bien, avísele a Recursos Humanos.">
              <DatosPersonalesVista f={f} />
            </SoloLectura>
          )}
        </PanelDePestana>

        <PanelDePestana id="laborales" actual={pestana} prefijo="mc">
          {!f ? (
            <SinFuncionario />
          ) : perfil.puedeEditarLaborales && perfil.opcionesLaborales ? (
            <FormularioLaboralPropio
              f={f}
              opciones={perfil.opcionesLaborales}
              alEditar={() => setAviso(null)}
              alGuardar={(nuevo) => {
                setPerfil(nuevo);
                setAviso('Sus datos laborales se guardaron. El cambio quedó registrado en la bitácora y en su historial laboral.');
              }}
            />
          ) : (
            <SoloLectura nota="Estos datos solo los modifica Recursos Humanos. Si algo no está bien, avísele.">
              <DatosLaboralesVista f={f} />
            </SoloLectura>
          )}
        </PanelDePestana>

        <PanelDePestana id="acceso" actual={pestana} prefijo="mc">
          <AccesoYSeguridad cuenta={perfil.cuenta} alCambiarContrasena={() => setAviso('Contraseña actualizada. La próxima vez ingrese con la nueva.')} />
        </PanelDePestana>
      </div>
    </section>
  );
}

function SinFuncionario() {
  return (
    <Mensaje tipo="info">
      Esta es la cuenta técnica de Informática: no está ligada a un funcionario, así que no tiene datos personales ni
      laborales.
    </Mensaje>
  );
}

/** Tarjeta con la vista de solo lectura y, debajo, por que no se puede cambiar. */
function SoloLectura({ nota, children }: { nota: string; children: ReactNode }) {
  return (
    <>
      <div className="card">{children}</div>
      <p className="nota-pagina mc-nota">{nota}</p>
    </>
  );
}
