import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'true ativa a conta; false desativa.' })
  @IsBoolean()
  isActive!: boolean;
}
