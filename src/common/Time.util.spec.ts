import {
  timeToMins,
  minsToTime,
  overlaps,
  contains,
  ceilTo,
} from './Time.util';

describe('Time.util', () => {
  it('should convert time string to minutes', () => {
    expect(timeToMins('00:00')).toBe(0);
    expect(timeToMins('01:30')).toBe(90);
    expect(timeToMins('23:59')).toBe(1439);
  });

  it('should convert minutes to padded HH:mm string', () => {
    expect(minsToTime(0)).toBe('00:00');
    expect(minsToTime(65)).toBe('01:05');
    expect(minsToTime(810)).toBe('13:30');
  });

  it('should check if two intervals overlap', () => {
    expect(overlaps({ start: 60, end: 120 }, { start: 90, end: 150 })).toBe(
      true,
    );
    expect(overlaps({ start: 60, end: 120 }, { start: 120, end: 180 })).toBe(
      false,
    );
    expect(overlaps({ start: 120, end: 180 }, { start: 60, end: 120 })).toBe(
      false,
    );
  });

  it('should check if outer interval contains inner interval', () => {
    expect(contains({ start: 60, end: 180 }, { start: 60, end: 180 })).toBe(
      true,
    );
    expect(contains({ start: 60, end: 180 }, { start: 90, end: 120 })).toBe(
      true,
    );
    expect(contains({ start: 60, end: 180 }, { start: 30, end: 120 })).toBe(
      false,
    );
    expect(contains({ start: 60, end: 180 }, { start: 90, end: 200 })).toBe(
      false,
    );
  });

  it('should ceil minutes to the given step', () => {
    expect(ceilTo(60, 15)).toBe(60);
    expect(ceilTo(61, 15)).toBe(75);
    expect(ceilTo(0, 30)).toBe(0);
  });
});
