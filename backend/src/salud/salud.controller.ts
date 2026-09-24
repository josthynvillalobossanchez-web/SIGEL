import { Controller, Get } from '@nestjs/common';
import { Publico } from '../autenticacion/decoradores.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Endpoint de comprobacion: sirve para saber, de un vistazo, si la API
 * esta arriba y si alcanza la base de datos.
 * GET http://localhost:3000/api/salud
 */
@Publico() // la comprobacion de salud no exige sesion
@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async consultar() {
    const baseDeDatos = await this.prisma.estaViva();
    return {
      sistema: 'SIGEL',
      estado: baseDeDatos ? 'operativo' : 'sin base de datos',
      baseDeDatos: baseDeDatos ? 'conectada' : 'no disponible',
      fechaHora: new Date().toISOString(),
    };
  }
}
