import { PartialType } from '@nestjs/swagger';
import { CreateBusinessProfessionalDto } from './create-business-professional-dto';

export class UpdateBusinessProfessionalDto extends PartialType(
  CreateBusinessProfessionalDto,
) {}
