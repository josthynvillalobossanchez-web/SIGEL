import { Module } from '@nestjs/common';
import { AlmacenCifradoService } from './almacen-cifrado.service.js';

/**
 * Almacen de archivos cifrados. Lo usan la gestion documental y las fotos
 * de perfil (y mas adelante los PDF que genera SINERGIA y los comprobantes
 * de incapacidades). Ver AlmacenCifradoService.
 */
@Module({
  providers: [AlmacenCifradoService],
  exports: [AlmacenCifradoService],
})
export class AlmacenamientoModule {}
