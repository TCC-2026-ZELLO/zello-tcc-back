import { PartialType } from '@nestjs/swagger';
import { CreateBusinessManagerDto } from './create-business-manager.dto';

export class UpdateBusinessManagerDto extends PartialType(
  CreateBusinessManagerDto,
) {}
