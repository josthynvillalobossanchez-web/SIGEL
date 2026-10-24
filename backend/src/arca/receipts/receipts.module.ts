import { Module } from '@nestjs/common';
import { ClientsController } from '../clients/clients.controller.js';
import { ClientsService } from '../clients/clients.service.js';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';

/** Recibos y clientes comparten módulo porque la ficha del cliente consulta su historial de recibos. */
@Module({
  controllers: [ReceiptsController, ClientsController],
  providers: [ReceiptsService, ClientsService],
  exports: [ReceiptsService, ClientsService],
})
export class ReceiptsModule {}
