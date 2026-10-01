import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { AlmacenCifradoService } from '../almacenamiento/almacen-cifrado.service.js';
import { detectarFormato, FORMATOS, TAMANO_MAXIMO_FOTO, validarArchivo, type ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { FuncionariosService } from '../funcionarios/funcionarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Fotografia de perfil (pendiente 13).
 *
 * Reglas (Josthyn, 30/09): JPG o PNG de hasta 5 MB; cada persona cambia la
 * suya (perfilPropio.editar) y Recursos Humanos la de cualquiera
 * (funcionarios.editar), respetando "para arriba no": a quien tiene una
 * cuenta con mas acceso no se le cambia. Se guarda con el mismo cifrado que
 * los documentos y la ruta nunca sale del backend: se sirve por
 * GET /api/funcionarios/:id/foto. Ver la foto de otra persona pide
 * funcionarios.ver o usuarios.ver; la propia, siempre. La foto anterior queda en disco (no
 * se borra nada) pero deja de usarse.
 */
@Injectable()
export class FotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly almacen: AlmacenCifradoService,
    private readonly funcionarios: FuncionariosService,
  ) {}

  /** Devuelve la foto descifrada y su tipo, o 404 si no tiene. */
  async ver(funcionarioId: string, quienActua: UsuarioAutenticado): Promise<{ contenido: Buffer; mime: string }> {
    // La propia, o quien ve funcionarios o cuentas de usuario (Usuarios muestra la foto de la persona de cada cuenta).
    if (funcionarioId !== quienActua.funcionarioId && !quienActua.permisos.includes('funcionarios.ver') && !quienActua.permisos.includes('usuarios.ver')) {
      throw new ForbiddenException({ codigo: 'SIN_PERMISO', message: 'No tiene permiso para ver esta fotografía.' });
    }
    const f = await this.prisma.funcionario.findUnique({ where: { id: funcionarioId }, select: { fotoRuta: true } });
    if (!f?.fotoRuta) throw new NotFoundException({ codigo: 'SIN_FOTOGRAFIA', message: 'Esta persona no tiene fotografía.' });
    const contenido = await this.almacen.leer(f.fotoRuta);
    const formato = detectarFormato(contenido);
    return { contenido, mime: formato ? FORMATOS[formato].mime : 'application/octet-stream' };
  }

  async cambiar(funcionarioId: string, archivo: ArchivoSubido | undefined, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<{ tieneFoto: true }> {
    const nombre = await this.revisarAnotandoDenegado(funcionarioId, quienActua, 'cambiar una fotografía de perfil', direccionIp);
    // Validacion ANTES de guardar: si no cumple, no se escribe nada.
    validarArchivo(archivo, ['jpg', 'png'], TAMANO_MAXIMO_FOTO, 'la fotografía');

    const ruta = await this.almacen.guardar('fotos', funcionarioId, archivo!.buffer);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.funcionario.update({ where: { id: funcionarioId }, data: { fotoRuta: ruta } });
        await this.bitacora.registrar(
          {
            usuarioId: quienActua.id,
            entidad: 'funcionario',
            registroAfectadoId: funcionarioId,
            funcionarioAfectadoId: funcionarioId,
            accion: 'modificar',
            direccionIp,
            datosNuevos: { fotografia: 'actualizada' },
            descripcion: funcionarioId === quienActua.funcionarioId ? 'Cambió su fotografía de perfil.' : `Cambió la fotografía de perfil de ${nombre}.`,
          },
          tx,
        );
      });
    } catch (error) {
      await this.almacen.descartarRecienGuardado(ruta);
      throw error;
    }
    return { tieneFoto: true };
  }

  /** Quita la foto (vuelven las iniciales). El archivo anterior se conserva en disco. */
  async quitar(funcionarioId: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<{ tieneFoto: false }> {
    const nombre = await this.revisarAnotandoDenegado(funcionarioId, quienActua, 'quitar una fotografía de perfil', direccionIp);
    const actual = await this.prisma.funcionario.findUnique({ where: { id: funcionarioId }, select: { fotoRuta: true } });
    if (!actual?.fotoRuta) {
      throw new BadRequestException({ codigo: 'SIN_FOTOGRAFIA', message: 'Esta persona no tiene fotografía que quitar.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.funcionario.update({ where: { id: funcionarioId }, data: { fotoRuta: null } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'funcionario',
          registroAfectadoId: funcionarioId,
          funcionarioAfectadoId: funcionarioId,
          accion: 'modificar',
          direccionIp,
          datosNuevos: { fotografia: 'quitada' },
          descripcion: funcionarioId === quienActua.funcionarioId ? 'Quitó su fotografía de perfil.' : `Quitó la fotografía de perfil de ${nombre}.`,
        },
        tx,
      );
    });
    return { tieneFoto: false };
  }

  /** Igual que revisarQuienPuedeCambiar, pero si lo niega por permiso deja el intento en la bitacora. */
  private async revisarAnotandoDenegado(funcionarioId: string, quienActua: UsuarioAutenticado, intento: string, direccionIp?: string): Promise<string> {
    try {
      return await this.revisarQuienPuedeCambiar(funcionarioId, quienActua);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        try {
          await this.bitacora.registrar({
            usuarioId: quienActua.id,
            entidad: 'funcionario',
            registroAfectadoId: funcionarioId,
            funcionarioAfectadoId: funcionarioId,
            accion: 'modificar',
            direccionIp,
            datosNuevos: { denegado: true, motivo: (error.getResponse() as { codigo?: string }).codigo ?? 'SIN_PERMISO' },
            descripcion: `Intento denegado: quiso ${intento}${funcionarioId === quienActua.funcionarioId ? ' propia' : ' de otra persona'}.`,
          });
        } catch {
          // Si no se puede anotar, se deja el error original.
        }
      }
      throw error;
    }
  }

  /**
   * La propia: perfilPropio.editar. La ajena: funcionarios.editar y que su
   * cuenta no tenga mas acceso que quien actua. Devuelve el nombre de la persona.
   */
  private async revisarQuienPuedeCambiar(funcionarioId: string, quienActua: UsuarioAutenticado): Promise<string> {
    const f = await this.prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { nombre: true, primerApellido: true, segundoApellido: true },
    });
    if (!f) throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
    const nombre = [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');

    if (funcionarioId === quienActua.funcionarioId) {
      if (!quienActua.permisos.includes('perfilPropio.editar')) {
        throw new ForbiddenException({ codigo: 'SIN_PERMISO', message: 'No tiene permiso para cambiar sus datos personales.' });
      }
      return nombre;
    }
    if (!quienActua.permisos.includes('funcionarios.editar')) {
      throw new ForbiddenException({ codigo: 'SIN_PERMISO', message: 'Solo Recursos Humanos puede cambiar la fotografía de otra persona.' });
    }
    if (await this.funcionarios.cuentaTieneMasAcceso(funcionarioId, quienActua)) {
      throw new ForbiddenException({
        codigo: 'CUENTA_CON_MAYOR_ACCESO',
        message: `${nombre} tiene una cuenta con permisos que usted no tiene: no puede cambiar su fotografía.`,
      });
    }
    return nombre;
  }
}
