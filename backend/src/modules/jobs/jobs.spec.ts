import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { BatchScheduleDto } from './jobs.dto';

describe('BatchScheduleDto', () => {
  it('holds required fields', () => {
    const dto = new BatchScheduleDto();
    dto.jobIds = ['abc', 'def'];
    dto.scheduledAt = '2026-06-24T10:00:00Z';
    expect(dto.jobIds).toHaveLength(2);
    expect(dto.scheduledAt).toBeTruthy();
  });
});
