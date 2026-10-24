import { Module } from '@nestjs/common';
import { CashboxModule } from '../cashbox/cashbox.module.js';
import { ReceiptsModule } from '../receipts/receipts.module.js';
import { DashboardService } from './dashboard.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [CashboxModule, ReceiptsModule],
  controllers: [ReportsController],
  providers: [ReportsService, DashboardService],
})
export class ReportsModule {}
