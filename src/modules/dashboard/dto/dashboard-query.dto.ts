import { ApiProperty } from '@nestjs/swagger';
import {
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MAX_DASHBOARD_PERIOD_DAYS } from '../constants/dashboard.constants';
import { isIsoDate, validatePeriod } from '../helpers/period.helper';

@ValidatorConstraint({ name: 'isIsoCalendarDate', async: false })
export class IsIsoCalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isIsoDate(value);
  }

  defaultMessage(args: ValidationArguments): string {
    const label = args.property === 'from' ? 'inicial' : 'final';
    return `A data ${label} (${args.property}) deve ser uma data válida no formato YYYY-MM-DD.`;
  }
}

@ValidatorConstraint({ name: 'isValidDashboardPeriod', async: false })
export class IsValidDashboardPeriodConstraint implements ValidatorConstraintInterface {
  validate(to: unknown, args: ValidationArguments): boolean {
    const { from } = args.object as DashboardQueryDto;
    if (!isIsoDate(from) || !isIsoDate(to)) return true;
    return validatePeriod(from, to, MAX_DASHBOARD_PERIOD_DAYS) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const { from } = args.object as DashboardQueryDto;
    return (
      validatePeriod(from, args.value, MAX_DASHBOARD_PERIOD_DAYS) ??
      'Período inválido.'
    );
  }
}

export class DashboardQueryDto {
  @ApiProperty({
    description: 'Data inicial do período (inclusiva), no formato YYYY-MM-DD.',
    example: '2026-10-01',
  })
  @Validate(IsIsoCalendarDateConstraint)
  from: string;

  @ApiProperty({
    description: `Data final do período (inclusiva), no formato YYYY-MM-DD. Deve ser maior ou igual a "from"; intervalo máximo de ${MAX_DASHBOARD_PERIOD_DAYS} dias.`,
    example: '2026-10-31',
  })
  @Validate(IsIsoCalendarDateConstraint)
  @Validate(IsValidDashboardPeriodConstraint)
  to: string;
}
