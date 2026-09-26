/*
 * Mi cuenta > "Mis datos personales" (con perfilPropio.editar): cada quien
 * cambia todo lo personal menos la cedula, que la corrige Recursos Humanos
 * desde Funcionarios (decision de Josthyn, 28/09). Las reglas son las de
 * utilidades/validaciones.ts, iguales al backend.
 */
import { useMemo } from 'react';
import type { DetalleDeFuncionario } from '../../api/funcionarios';
import { actualizarMisDatos, type DatosPersonales, type PerfilPropio } from '../../api/miCuenta';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Lista, Texto } from '../../componentes/CamposDeFormulario';
import { Mensaje } from '../../componentes/Mensaje';
import { PieDeGuardado } from '../../componentes/PieDeGuardado';
import { hoyEnCostaRica } from '../../utilidades/fechas';
import { useFormularioDeCambios } from '../../utilidades/useFormularioDeCambios';
import {
  LARGO_APELLIDO,
  LARGO_NOMBRE,
  maximoDeNacimiento,
  normalizarTelefono,
  problemaDeContacto,
  problemaDeNacimiento,
  problemaDeNombres,
} from '../../utilidades/validaciones';

type Formulario = Record<keyof Required<DatosPersonales>, string>;

function personalesDesde(f: DetalleDeFuncionario): Formulario {
  return {
    nombre: f.nombre,
    primerApellido: f.primerApellido,
    segundoApellido: f.segundoApellido ?? '',
    fechaNacimiento: f.fechaNacimiento ?? '',
    profesionId: f.profesion?.id ?? '',
    correoPersonal: f.correoPersonal,
    correoInstitucional: f.correoInstitucional ?? '',
    telefonoPersonal: f.telefonoPersonal ?? '',
    direccion: f.direccion ?? '',
  };
}

export function FormularioPersonalPropio({
  perfil,
  f,
  alEditar,
  alGuardar,
}: {
  perfil: PerfilPropio;
  f: DetalleDeFuncionario;
  alEditar: () => void;
  alGuardar: (p: PerfilPropio) => void;
}) {
  const hoy = hoyEnCostaRica();
  const original = useMemo(() => personalesDesde(f), [f]);
  const formulario = useFormularioDeCambios(original, {
    revisar: (datos) => {
      const nacimiento = problemaDeNacimiento(datos.fechaNacimiento, hoy);
      return problemaDeNombres(datos) ?? (nacimiento ? `Fecha de nacimiento: ${nacimiento}` : null) ?? problemaDeContacto(datos);
    },
    enviar: (cambios) => actualizarMisDatos(cambios as DatosPersonales),
    alGuardar,
    alEditar,
  });
  const { datos, poner } = formulario;

  return (
    <form ref={formulario.formulario} className="card" noValidate onSubmit={formulario.alEnviar}>
      <div className="panel-paso">
        {formulario.error && <Mensaje tipo="error">{formulario.error}</Mensaje>}
        <div className="campo-fila mc-campos">
          <Texto id="mcNombre" etiqueta="Nombre" valor={datos.nombre} alCambiar={poner('nombre')} max={LARGO_NOMBRE} obligatorio />
          <Texto id="mcAp1" etiqueta="Primer apellido" valor={datos.primerApellido} alCambiar={poner('primerApellido')} max={LARGO_APELLIDO} obligatorio />
          <Texto id="mcAp2" etiqueta="Segundo apellido" valor={datos.segundoApellido} alCambiar={poner('segundoApellido')} max={LARGO_APELLIDO} />
          <CampoFecha
            id="mcNac"
            etiqueta="Fecha de nacimiento"
            valor={datos.fechaNacimiento}
            alCambiar={poner('fechaNacimiento')}
            min="1900-01-01"
            max={maximoDeNacimiento(hoy)}
            error={problemaDeNacimiento(datos.fechaNacimiento, hoy)}
          />
          <div className="campo">
            <label htmlFor="mcCedula">Cédula</label>
            <input id="mcCedula" readOnly className="solo-lectura num" value={f.cedula} aria-describedby="mcNotaPersonales" />
          </div>
          <Texto
            id="mcTel"
            etiqueta="Teléfono"
            tipo="tel"
            valor={datos.telefonoPersonal}
            alCambiar={poner('telefonoPersonal')}
            alSalir={() => {
              const normal = normalizarTelefono(datos.telefonoPersonal);
              if (normal) formulario.setDatos((d) => ({ ...d, telefonoPersonal: normal }));
            }}
            max={16}
            placeholder="8 dígitos: 8712-4408"
          />
          <Texto id="mcCorreoP" etiqueta="Correo personal" tipo="email" valor={datos.correoPersonal} alCambiar={poner('correoPersonal')} max={150} obligatorio />
          <Texto id="mcCorreoI" etiqueta="Correo institucional" tipo="email" valor={datos.correoInstitucional} alCambiar={poner('correoInstitucional')} max={150} />
          <Lista
            id="mcProf"
            etiqueta="Profesión"
            valor={datos.profesionId}
            alCambiar={poner('profesionId')}
            opciones={perfil.profesiones}
            vacio={perfil.profesiones.length ? 'Sin profesión registrada' : 'Todavía no hay profesiones en el catálogo'}
          />
          <div className="campo mc-direccion">
            <label htmlFor="mcDir">Dirección exacta</label>
            <input id="mcDir" type="text" value={datos.direccion} onChange={(e) => poner('direccion')(e.target.value)} maxLength={255} autoComplete="off" />
          </div>
        </div>
      </div>
      <PieDeGuardado
        nota="Cada cambio queda en la bitácora. La cédula la corrige Recursos Humanos."
        idNota="mcNotaPersonales"
        que="datos personales"
        hayCambios={formulario.hayCambios}
        ocupado={formulario.ocupado}
        alDescartar={formulario.descartar}
      />
    </form>
  );
}
