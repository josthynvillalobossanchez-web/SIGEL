import { EditarFuncionarioDto } from '../../funcionarios/dto/datos-de-funcionario.dto.js';

/*
 * "Mi cuenta" usa las MISMAS reglas que "Editar funcionario" (nombres,
 * telefono de Costa Rica, correos, fechas): un solo lugar donde cambiarlas.
 * Lo que cada formulario puede tocar lo limita el servicio con
 * CAMPOS_PERSONALES_PROPIOS y CAMPOS_LABORALES (ver funcionarios.service.ts);
 * si llega otro campo responde DATOS_INVALIDOS.
 */

/** Datos personales propios: todo lo personal menos la cedula (perfilPropio.editar). */
export class ActualizarDatosPersonalesDto extends EditarFuncionarioDto {}

/** Datos laborales propios: solo para quien tiene funcionarios.editar (RRHH). */
export class ActualizarDatosLaboralesDto extends EditarFuncionarioDto {}
