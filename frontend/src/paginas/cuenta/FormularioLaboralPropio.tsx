/*
 * Mi cuenta > "Datos laborales" para Recursos Humanos (funcionarios.editar):
 * cambia SUS PROPIOS datos laborales (decision de Josthyn, 28/09). Quien no
 * es RRHH solo los ve (DatosLaboralesVista). El estado y el personal a cargo
 * se muestran pero no se editan aqui.
 */
import { useMemo } from 'react';
import { nombreDeRegimen, type DetalleDeFuncionario, type OpcionesDeFormulario } from '../../api/funcionarios';
import { actualizarMisDatosLaborales, type DatosLaborales, type PerfilPropio } from '../../api/miCuenta';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Lista, Texto } from '../../componentes/CamposDeFormulario';
import { Mensaje } from '../../componentes/Mensaje';
import { PieDeGuardado } from '../../componentes/PieDeGuardado';
import { hoyEnCostaRica } from '../../utilidades/fechas';
import { useFormularioDeCambios } from '../../utilidades/useFormularioDeCambios';
import { maximoDeIngreso, minimoDeIngreso, problemaDeCodigoDeEmpleado, problemaDeIngreso } from '../../utilidades/validaciones';
import { ChipDeFuncionario } from '../funcionarios/ChipDeFuncionario';
import { listasConActuales, opcionesDeJefatura } from '../funcionarios/listasDeFormulario';

type Formulario = Record<keyof Required<DatosLaborales>, string>;

function laboralesDesde(f: DetalleDeFuncionario): Formulario {
  return {
    puestoId: f.puesto?.id ?? '',
    departamentoId: f.departamento?.id ?? '',
    jefaturaId: f.jefatura?.id ?? '',
    tipoNombramiento: f.tipoNombramiento,
    regimenVacacionesId: f.regimenVacaciones.id,
    fechaIngreso: f.fechaIngreso,
    numeroEmpleado: f.numeroEmpleado ?? '',
  };
}

export function FormularioLaboralPropio({
  f,
  opciones,
  alEditar,
  alGuardar,
}: {
  f: DetalleDeFuncionario;
  opciones: OpcionesDeFormulario;
  alEditar: () => void;
  alGuardar: (p: PerfilPropio) => void;
}) {
  const hoy = hoyEnCostaRica();
  const original = useMemo(() => laboralesDesde(f), [f]);
  const listas = useMemo(() => listasConActuales(opciones, f), [opciones, f]);
  const formulario = useFormularioDeCambios(original, {
    revisar: (datos) => {
      const ingreso = problemaDeIngreso(datos.fechaIngreso, f.fechaNacimiento, hoy);
      return (
        // Si el registro viejo no tenia puesto o departamento, no se exige para cambiar otra cosa.
        (!datos.puestoId && original.puestoId ? 'Elija el puesto.' : null) ??
        (!datos.departamentoId && original.departamentoId ? 'Elija el departamento.' : null) ??
        (!datos.fechaIngreso ? 'La fecha de ingreso es obligatoria.' : null) ??
        (ingreso ? `Fecha de ingreso: ${ingreso}` : null) ??
        problemaDeCodigoDeEmpleado(datos.numeroEmpleado)
      );
    },
    enviar: (cambios) => actualizarMisDatosLaborales(cambios as DatosLaborales),
    alGuardar,
    alEditar,
  });
  const { datos, poner } = formulario;

  return (
    <form ref={formulario.formulario} className="card" noValidate onSubmit={formulario.alEnviar}>
      <div className="panel-paso">
        {formulario.error && <Mensaje tipo="error">{formulario.error}</Mensaje>}
        <div className="campo-fila mc-campos">
          <Lista id="mcPuesto" etiqueta="Puesto" valor={datos.puestoId} alCambiar={poner('puestoId')} opciones={listas.puestos} obligatorio />
          <Lista id="mcDepto" etiqueta="Departamento" valor={datos.departamentoId} alCambiar={poner('departamentoId')} opciones={listas.departamentos} obligatorio />
          <Lista
            id="mcJefe"
            etiqueta="Jefatura inmediata"
            valor={datos.jefaturaId}
            alCambiar={poner('jefaturaId')}
            opciones={opcionesDeJefatura(listas.jefaturas)}
            vacio="— Sin jefatura: tope de la jerarquía —"
            ayuda={opciones.jefaturas.length ? 'Solo quienes tienen el rol Aprobador.' : 'Nadie tiene todavía el rol Aprobador.'}
          />
          <Texto id="mcCodigo" etiqueta="Código de empleado" valor={datos.numeroEmpleado} alCambiar={poner('numeroEmpleado')} max={30} />
          <Lista
            id="mcNombramiento"
            etiqueta="Tipo de nombramiento"
            valor={datos.tipoNombramiento}
            alCambiar={poner('tipoNombramiento')}
            opciones={opciones.tiposNombramiento.map((t) => ({ id: t.valor, nombre: t.texto }))}
            obligatorio
          />
          <Lista
            id="mcRegimen"
            etiqueta="Régimen de vacaciones"
            valor={datos.regimenVacacionesId}
            alCambiar={poner('regimenVacacionesId')}
            opciones={listas.regimenes.map((r) => ({ id: r.id, nombre: nombreDeRegimen(r.nombre) }))}
            obligatorio
          />
          <CampoFecha
            id="mcIngreso"
            etiqueta="Fecha de ingreso"
            valor={datos.fechaIngreso}
            alCambiar={poner('fechaIngreso')}
            min={minimoDeIngreso(f.fechaNacimiento)}
            max={maximoDeIngreso(hoy)}
            obligatorio
            error={problemaDeIngreso(datos.fechaIngreso, f.fechaNacimiento, hoy)}
          />
          {/* Datos laborales que no se editan aqui (el estado cambia con salida o reingreso). */}
          <dl className="campo mc-fijos">
            <div>
              <dt>Estado</dt>
              <dd>
                <ChipDeFuncionario estado={f.estado} />
              </dd>
            </div>
            <div>
              <dt>Personal a cargo</dt>
              <dd className="num">{f.cantidadACargo}</dd>
            </div>
          </dl>
        </div>
      </div>
      <PieDeGuardado
        nota="Solo Recursos Humanos cambia datos laborales. Cada cambio queda en la bitácora y en su historial laboral."
        que="datos laborales"
        hayCambios={formulario.hayCambios}
        ocupado={formulario.ocupado}
        alDescartar={formulario.descartar}
      />
    </form>
  );
}
