import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';

export interface ComboTask {
  item: ComboItem;
  serviceId: string;
  serviceName: string;
  sequence: number;
  offset: number;
  duration: number;
  block: number;
}

export interface ComboStage {
  sequence: number;
  offset: number;
  duration: number;
  block: number;
  tasks: ComboTask[];
}

export interface ComboPlan {
  stages: ComboStage[];
  tasks: ComboTask[];
  totalDuration: number;
  totalBlock: number;
  originalPrice: number;
  finalPrice: number;
  discount: number;
  discountPercent: number;
}

export function buildComboPlan(combo: Combo): ComboPlan {
  const items = [...(combo.items ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );

  const sequences = [...new Set(items.map((i) => i.sequence))].sort(
    (a, b) => a - b,
  );

  const stages: ComboStage[] = [];
  const tasks: ComboTask[] = [];
  let offset = 0;

  for (const sequence of sequences) {
    const stageItems = items.filter((i) => i.sequence === sequence);

    const stageTasks = stageItems.map<ComboTask>((item) => {
      const duration = item.service.durationMinutes ?? 0;
      const cleanup = item.service.cleanupMinutes ?? 0;
      return {
        item,
        serviceId: item.service.id,
        serviceName: item.service.name,
        sequence,
        offset,
        duration,
        block: duration + cleanup,
      };
    });

    const duration = Math.max(...stageTasks.map((t) => t.duration));
    const block = Math.max(...stageTasks.map((t) => t.block));

    tasks.push(...stageTasks);
    stages.push({ sequence, offset, duration, block, tasks: stageTasks });
    offset += block;
  }

  const totalDuration = tasks.reduce(
    (max, t) => Math.max(max, t.offset + t.duration),
    0,
  );
  const totalBlock = tasks.reduce(
    (max, t) => Math.max(max, t.offset + t.block),
    0,
  );

  const originalPrice = round2(
    items.reduce((sum, i) => sum + Number(i.service.price ?? 0), 0),
  );
  const finalPrice = round2(Number(combo.price ?? 0));
  const discount = round2(originalPrice - finalPrice);

  return {
    stages,
    tasks,
    totalDuration,
    totalBlock,
    originalPrice,
    finalPrice,
    discount,
    discountPercent:
      originalPrice > 0 ? Math.round((discount / originalPrice) * 100) : 0,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
