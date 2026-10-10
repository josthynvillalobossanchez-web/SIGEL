import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DocumentosService, type ArchivoAbierto } from '../documentos/documentos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearSolicitudDto } from '../vacaciones/dto/solicitudes.dto.js';
import { SolicitudesService, type SolicitudDeLista } from '../vacaciones/solicitudes.service.js';

/**
 * Solicitudes que llevan JUSTIFICANTE (por ejemplo, una licencia): el
 * archivo y la solicitud se mandan juntos. Primero se revisa que la
 * solicitud se pueda hacer (mismas reglas de siempre), despues el archivo
 * se guarda en el expediente de la persona y por ultimo se crea la
 * solicitud con ese justificante. Si la solicitud falla, el justificante
 * queda dado de baja (nunca se borra).
 */
@Injectable()
export class JustificantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly solicitudes: SolicitudesService,
    private readonly documentos: DocumentosService,
  ) {}

  async crearConJustificante(datos: CrearSolicitudDto, archivo: ArchivoSubido | undefined, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<SolicitudDeLista> {
    const previa = (await this.solicitudes.calcular({ ...datos, justificanteDocumentoId: undefined }, quienActua)) as {
      valida: boolean;
      problema: { codigo?: string; mensaje?: string } | null;
    };
    // Lo unico que puede faltar todavia es el justificante: viene en este mismo envio.
    if (!previa.valida && previa.problema?.codigo !== 'JUSTIFICANTE_REQUERIDO') {
      throw new BadRequestException({ codigo: previa.problema?.codigo ?? 'SOLICITUD_NO_VALIDA', message: previa.problema?.mensaje ?? 'No se puede hacer esta solicitud.' });
    }
    const funcionarioId = datos.funcionarioId ?? quienActua.funcionarioId!;
    const tipo = await this.prisma.tipoSolicitud.findUnique({ where: { id: datos.tipoSolicitudId }, select: { nombre: true } });
    const adjunto = await this.documentos.registrarAdjunto({
      funcionarioId,
      nombreDelTipo: 'Justificante de solicitud',
      titulo: `Justificante: ${tipo?.nombre ?? 'solicitud'} del ${datos.fechaInicio} al ${datos.fechaFin}`,
      archivo,
      quienActua,
      direccionIp,
    });
    try {
      return await this.solicitudes.crear({ ...datos, justificanteDocumentoId: adjunto.id }, quienActua, direccionIp);
    } catch (error) {
      await this.documentos.descartarAdjunto(adjunto.id, quienActua);
      throw error;
    }
  }

  /** El justificante de una solicitud, para quien puede ver esa solicitud (la persona, su jefatura o RRHH). */
  async abrir(solicitudId: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<ArchivoAbierto> {
    const s = await this.solicitudes.detalle(solicitudId, quienActua); // revisa el acceso
    if (!s.justificanteId) throw new NotFoundException({ codigo: 'SIN_JUSTIFICANTE', message: 'Esta solicitud no tiene justificante.' });
    return this.documentos.abrirAdjunto(s.justificanteId, quienActua, direccionIp);
  }
}
