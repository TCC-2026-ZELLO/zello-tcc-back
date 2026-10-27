import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Senha atual do usuário, necessária para alterar a senha',
    example: 'Zello@2026!',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
