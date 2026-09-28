import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AvailabilityService } from '../availability/availability.service';
import { BusinessProfessional } from '../business-professionals/entities/business-professional.entity';
import { CombosService } from './combos.service';
import { buildComboPlan, ComboPlan, ComboTask } from './combo-plan';
import {
  ceilTo,
  contains,
  Interval,
  minsToTime,
  overlaps,
  timeToMins,
} from '../../common/Time.util';

interface Bound {
  start: string;
  end: string;
}

export interface ComboAssignment {
  sequence: number;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startTime: string;
  endTime: string;
  blockedUntil: string;
}

export interface ComboSlot {
  startTime: string;
  endTime: string;
  assignments: ComboAssignment[];
}

const DEFAULT_GRANULARITY = 15;
const MAX_SLOTS = 96;

@Injectable()
export class ComboAvailabilityService {
  constructor(
    @Inject(forwardRef(() => AvailabilityService))
    private readonly availabilityService: AvailabilityService,
    @InjectRepository(BusinessProfessional)
    private readonly bpRepo: Repository<BusinessProfessional>,
    private readonly combosService: CombosService,
  ) {}

  async getSlots(params: {
    comboId: string;
    date: string;
    granularity?: number;
    preferred?: Record<string, string>;
  }): Promise<ComboSlot[]> {
    const ctx = await this.buildContext(params);
    if (!ctx) return [];

    const step = params.granularity ?? DEFAULT_GRANULARITY;
    const slots: ComboSlot[] = [];

    for (const start of this.candidateStarts(ctx, step)) {
      const assignments = this.solve(ctx, start);
      if (!assignments) continue;

      slots.push({
        startTime: minsToTime(start),
        endTime: minsToTime(start + ctx.plan.totalDuration),
        assignments,
      });

      if (slots.length >= MAX_SLOTS) break;
    }

    return slots;
  }

  async resolveAssignments(params: {
    comboId: string;
    date: string;
    startTime: string;
    preferred?: Record<string, string>;
  }): Promise<ComboSlot | null> {
    const ctx = await this.buildContext(params);
    if (!ctx) return null;

    const start = timeToMins(params.startTime);
    const assignments = this.solve(ctx, start);
    if (!assignments) return null;

    return {
      startTime: params.startTime,
      endTime: minsToTime(start + ctx.plan.totalDuration),
      assignments,
    };
  }

  async getPlan(comboId: string): Promise<ComboPlan> {
    return buildComboPlan(await this.combosService.findEntity(comboId));
  }


  private async buildContext(params: {
    comboId: string;
    date: string;
    preferred?: Record<string, string>;
  }): Promise<SolverContext | null> {
    const combo = await this.combosService.findEntity(params.comboId);
    if (!combo.active) return null;

    const plan = buildComboPlan(combo);
    const businessId = combo.business.id;

    const providers = await this.providersByService(businessId);
    const names = new Map<string, string>();

    const tasks: SolverTask[] = [];
    for (const task of plan.tasks) {
      let candidates = providers.get(task.serviceId) ?? [];

      const preferredId = params.preferred?.[task.serviceId];
      if (preferredId) {
        const match = candidates.find((p) => p.id === preferredId);
        candidates = match ? [match] : [];
      }

      if (candidates.length === 0) return null;

      candidates.forEach((p) => names.set(p.id, p.name));
      tasks.push({ ...task, candidates: candidates.map((p) => p.id) });
    }

    tasks.sort((a, b) => a.candidates.length - b.candidates.length);

    const bounds = await this.prefetchBounds(params.date, businessId, tasks);

    return { plan, businessId, date: params.date, tasks, bounds, names };
  }

  private async providersByService(businessId: string) {
    const links = await this.bpRepo.find({
      where: { business: { id: businessId } },
      relations: [
        'professional',
        'professional.user',
        'services',
        'services.service',
      ],
    });

    const map = new Map<string, { id: string; name: string }[]>();

    for (const link of links) {
      const professional = {
        id: link.professional.id,
        name: link.professional.user?.name ?? 'Profissional',
      };

      for (const bps of link.services ?? []) {
        const serviceId = bps.service?.id;
        if (!serviceId) continue;
        const list = map.get(serviceId) ?? [];
        if (!list.some((p) => p.id === professional.id))
          list.push(professional);
        map.set(serviceId, list);
      }
    }

    return map;
  }

  private async prefetchBounds(
    date: string,
    businessId: string,
    tasks: SolverTask[],
  ) {
    const bounds = new Map<string, Bound[]>();

    const pairs = tasks.flatMap((task) =>
      task.candidates.map((professionalId) => ({
        serviceId: task.serviceId,
        professionalId,
      })),
    );

    await Promise.all(
      pairs.map(async ({ serviceId, professionalId }) => {
        const key = `${serviceId}|${professionalId}`;
        if (bounds.has(key)) return;
        bounds.set(
          key,
          await this.availabilityService.getAvailableBounds(
            date,
            businessId,
            serviceId,
            professionalId,
          ),
        );
      }),
    );

    return bounds;
  }

  private candidateStarts(ctx: SolverContext, step: number): number[] {
    let earliest = Infinity;
    let latest = -Infinity;

    for (const list of ctx.bounds.values()) {
      for (const bound of list) {
        earliest = Math.min(earliest, timeToMins(bound.start));
        latest = Math.max(latest, timeToMins(bound.end));
      }
    }

    if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return [];

    const starts: number[] = [];
    const last = latest - ctx.plan.totalBlock;

    for (let t = ceilTo(earliest, step); t <= last; t += step) {
      if (t + ctx.plan.totalBlock <= 24 * 60) starts.push(t);
    }

    return starts;
  }

  private solve(ctx: SolverContext, start: number): ComboAssignment[] | null {
    const busy = new Map<string, Interval[]>();
    const chosen: ComboAssignment[] = [];

    const step = (index: number): boolean => {
      if (index === ctx.tasks.length) return true;

      const task = ctx.tasks[index];
      const window: Interval = {
        start: start + task.offset,
        end: start + task.offset + task.block,
      };

      for (const professionalId of task.candidates) {
        const taken = busy.get(professionalId) ?? [];
        if (taken.some((interval) => overlaps(interval, window))) continue;
        if (!this.fits(ctx, task.serviceId, professionalId, window)) continue;

        taken.push(window);
        busy.set(professionalId, taken);
        chosen.push({
          sequence: task.sequence,
          serviceId: task.serviceId,
          serviceName: task.serviceName,
          professionalId,
          professionalName: ctx.names.get(professionalId) ?? 'Profissional',
          startTime: minsToTime(window.start),
          endTime: minsToTime(window.start + task.duration),
          blockedUntil: minsToTime(window.end),
        });

        if (step(index + 1)) return true;

        taken.pop();
        chosen.pop();
      }

      return false;
    };

    if (!step(0)) return null;

    return [...chosen].sort(
      (a, b) =>
        a.sequence - b.sequence || a.startTime.localeCompare(b.startTime),
    );
  }

  private fits(
    ctx: SolverContext,
    serviceId: string,
    professionalId: string,
    window: Interval,
  ): boolean {
    const list = ctx.bounds.get(`${serviceId}|${professionalId}`) ?? [];
    return list.some((bound) =>
      contains(
        { start: timeToMins(bound.start), end: timeToMins(bound.end) },
        window,
      ),
    );
  }
}

interface SolverTask extends ComboTask {
  candidates: string[];
}

interface SolverContext {
  plan: ComboPlan;
  businessId: string;
  date: string;
  tasks: SolverTask[];
  bounds: Map<string, Bound[]>;
  names: Map<string, string>;
}
