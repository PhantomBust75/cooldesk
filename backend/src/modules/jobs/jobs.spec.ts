import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BatchScheduleDto } from './jobs.dto';

const JOB_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const TECH_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('BatchScheduleDto', () => {
  it('accepts valid input', async () => {
    const dto = plainToInstance(BatchScheduleDto, {
      jobIds: [JOB_UUID],
      scheduledAt: '2026-06-24T10:00:00.000Z',
      technicianId: TECH_UUID,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty jobIds array', async () => {
    const dto = plainToInstance(BatchScheduleDto, {
      jobIds: [],
      scheduledAt: '2026-06-24T10:00:00.000Z',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('jobIds');
  });

  it('rejects invalid scheduledAt', async () => {
    const dto = plainToInstance(BatchScheduleDto, {
      jobIds: [JOB_UUID],
      scheduledAt: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('scheduledAt');
  });

  it('accepts missing technicianId (optional)', async () => {
    const dto = plainToInstance(BatchScheduleDto, {
      jobIds: [JOB_UUID],
      scheduledAt: '2026-06-24T10:00:00.000Z',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
