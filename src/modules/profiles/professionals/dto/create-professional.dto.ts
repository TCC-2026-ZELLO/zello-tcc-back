import { IsUUID, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfessionalDto {
  @ApiProperty({
    description: 'UUID do usuário ao qual este perfil profissional pertence',
    example: 'a3f1c2d4-e5b6-4890-abcd-ef1234567890',
  })
  @IsUUID('4', { message: 'O ID do usuário deve ser um UUID válido.' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Biografia de apresentação profissional',
    example:
      'Especialista em visagismo, cortes modernos e colorimetria com mais de 8 anos de experiência.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Define se o perfil do profissional está visível nas buscas',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;
}
