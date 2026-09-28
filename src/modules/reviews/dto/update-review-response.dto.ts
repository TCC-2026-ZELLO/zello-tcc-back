import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewResponseDto } from './create-review-response.dto';

export class UpdateReviewResponseDto extends PartialType(
  CreateReviewResponseDto,
) {}
