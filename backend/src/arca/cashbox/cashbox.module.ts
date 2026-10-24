import { Module } from '@nestjs/common';
import { CashboxController } from './cashbox.controller.js';
import { CashboxService } from './cashbox.service.js';

@Module({
  controllers: [CashboxController],
  providers: [CashboxService],
  exports: [CashboxService],
})
export class CashboxModule {}
