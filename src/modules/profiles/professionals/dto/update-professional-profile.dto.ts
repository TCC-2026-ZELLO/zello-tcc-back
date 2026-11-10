import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfessionalProfileDto {
  @ApiPropertyOptional({
    description: 'Biografia detalhada do profissional (máx. 1000 caracteres)',
    example:
      'Especialista em colorimetria avançada, mechas iluminadas e tratamentos capilares reconstrutores. Formada pela Academia L’Oréal Professionnel.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Especialidade principal exibida no perfil',
    example: 'Colorista e Visagista',
  })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({
    description: 'URL do perfil profissional no Instagram',
    example: 'https://instagram.com/camila.visagismo',
  })
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiPropertyOptional({
    description: 'Controla a visibilidade pública do perfil nas buscas',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  visibilityStatus?: boolean;
}
