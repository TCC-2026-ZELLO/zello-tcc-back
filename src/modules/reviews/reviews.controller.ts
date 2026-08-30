import { Controller, Get, Post, Body, Param, UseGuards, Request, ValidationPipe, UsePipes } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() createReviewDto: CreateReviewDto, @Request() req) {
    return this.reviewsService.create(createReviewDto, req.user.id);
  }

  @Get('professional/:id')
  findByProfessional(@Param('id') professionalId: string) {
    return this.reviewsService.findByProfessional(professionalId);
  }

  @Get('business/:id')
  findByBusiness(@Param('id') businessId: string) {
    return this.reviewsService.findByBusiness(businessId);
  }

  @Get('appointment/:id')
  @UseGuards(JwtAuthGuard)
  findByAppointment(@Param('id') appointmentId: string, @Request() req) {
    return this.reviewsService.findByAppointment(appointmentId, req.user.id);
  }

  @Get('me/sent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  findSentByClient(@Request() req) {
    return this.reviewsService.findSentByClient(req.user.id);
  }

  @Get('me/received')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('professional')
  findReceivedByProfessional(@Request() req) {
    return this.reviewsService.findReceivedByProfessional(req.user.professional.id);
  }
  
  @Get('business/:id/received')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  findReceivedByBusiness(@Param('id') businessId: string, @Request() req) {
    return this.reviewsService.findReceivedByBusiness(businessId);
  }
}
