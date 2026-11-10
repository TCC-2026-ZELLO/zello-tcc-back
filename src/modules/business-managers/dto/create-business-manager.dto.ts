import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessManagerDto {
  @ApiProperty({
    description: 'UUID do perfil de gestor (Manager) que será vinculado',
    example: '8f14e45f-ceea-467a-9a38-1b4d5e6f7a8b',
  })
  @IsNotEmpty()
  //@IsUUID()
  @IsString()
  managerId: string;

  @ApiProperty({
    description: 'UUID do estabelecimento ao qual o gestor será vinculado',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @IsNotEmpty()
  //@IsUUID()
  @IsString()
  businessId: string;
}
