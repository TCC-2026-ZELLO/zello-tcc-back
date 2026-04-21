import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import {  ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Senha atual do usuário, necessária para alterar a senha',
    example: 'SenhaAtual@123',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
