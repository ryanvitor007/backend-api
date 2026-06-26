import { Global, Module } from '@nestjs/common';
import { TransactionManager } from './utils/transaction.manager';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  providers: [TransactionManager, PermissionsGuard],
  exports: [TransactionManager, PermissionsGuard],
})
export class CommonModule {}
