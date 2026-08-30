import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review } from './entities/review.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Professional } from '../profiles/professionals/entities/professional.entity';
import { Business } from '../businesses/entities/business.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Appointment, Professional, Business]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
