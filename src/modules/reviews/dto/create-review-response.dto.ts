import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewResponseDto {
  @ApiProperty({
    description:
      'Texto de resposta oficial do profissional ou gestor à avaliação do cliente (5 a 1000 caracteres)',
    example:
      'Muito obrigado pelo carinho e confiança, Mariana! Ficamos super felizes que tenha gostado do resultado. Esperamos você em breve!',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  text: string;
}
