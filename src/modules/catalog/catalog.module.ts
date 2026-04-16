import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
