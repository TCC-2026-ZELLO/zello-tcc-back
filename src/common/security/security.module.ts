import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessManager } from '../../modules/business-managers/entities/business-manager.entity';
import { BusinessProfessional } from '../../modules/business-professionals/entities/business-professional.entity';
import { TenantAccessService } from './tenant-access.service';
import { SecurityEventLogger } from '../logging/security-event.logger';

/** Serviços transversais de segurança disponíveis para todos os módulos. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([BusinessManager, BusinessProfessional])],
  providers: [TenantAccessService, SecurityEventLogger],
  exports: [TenantAccessService, SecurityEventLogger],
})
export class SecurityModule {}
