import { PartialType } from '@nestjs/swagger';
import { CreateReviewResponseDto } from './create-review-response.dto';

export class UpdateReviewResponseDto extends PartialType(
  CreateReviewResponseDto,
) {}
