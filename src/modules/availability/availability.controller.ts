import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CreateBusinessOperatingHourDto } from './dto/create-business-operating-hour.dto';
import { CreateProfessionalShiftDto } from './dto/create-professional-shift.dto';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('operating-hours')
  @Roles('manager', 'admin')
  createOperatingHour(
    @Req() req: { user: ActiveUser },
    @Body() dto: CreateBusinessOperatingHourDto,
  ) {
    return this.availabilityService.createOperatingHour(dto, req.user);
  }

  @Post('shifts')
  @Roles('manager', 'professional', 'admin')
  createShift(@Body() dto: CreateProfessionalShiftDto) {
    return this.availabilityService.createShift(dto);
  }

  @Post('exceptions')
  @Roles('manager', 'professional', 'admin')
  createException(@Body() dto: CreateScheduleExceptionDto) {
    return this.availabilityService.createException(dto);
  }

  @Get('bounds')
  getAvailableBounds(
    @Query('date') date: string,
    @Query('professionalId') professionalId: string,
    @Query('businessId') businessId: string,
    @Query('serviceId') serviceId: string,
  ) {
    return this.availabilityService.getAvailableBounds(
      date,
      professionalId,
      businessId,
      serviceId,
    );
  }
}
