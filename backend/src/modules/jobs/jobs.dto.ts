import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type JobType = 'installation' | 'complaint';
export type JobSource = 'direct' | 'via_dealer';
export type JobStatus =
  | 'pending_schedule'
  | 'scheduled'
  | 'new'
  | 'assigned'
  | 'acknowledged'
  | 'in_transit'
  | 'in_process'
  | 'needs_revisit'
  | 'revisit_scheduled'
  | 'completed'
  | 'resolved'
  | 'resolved_on_revisit'
  | 'cancellation_requested'
  | 'cancelled';

export type RevisitReason =
  | 'part_unavailable'
  | 'customer_not_home'
  | 'issue_recurring'
  | 'further_diagnosis_required'
  | 'custom';

export class CreateJobUnitDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  label!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateJobDto {
  @IsEnum(['installation', 'complaint'])
  type!: JobType;

  @IsEnum(['direct', 'via_dealer'])
  source!: JobSource;

  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  dealerId?: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 32)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 300)
  address!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  issueDescription?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  installationNotes?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsEnum(['auto_link', 'create_new'])
  linkBehavior?: 'auto_link' | 'create_new';

  @IsOptional()
  @IsUUID()
  selectedVcid?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJobUnitDto)
  units?: CreateJobUnitDto[];
}

export class UpdateJobStatusDto {
  @IsEnum([
    'pending_schedule',
    'scheduled',
    'new',
    'assigned',
    'acknowledged',
    'in_transit',
    'in_process',
    'needs_revisit',
    'revisit_scheduled',
    'completed',
    'resolved',
    'resolved_on_revisit',
    'cancellation_requested',
    'cancelled',
  ])
  targetStatus!: JobStatus;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reason?: string;

  @IsOptional()
  confirmInProcessCancellation?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentAmount?: number;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsEnum([
    'part_unavailable',
    'customer_not_home',
    'issue_recurring',
    'further_diagnosis_required',
    'custom',
  ])
  revisitReason?: RevisitReason;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  customRevisitReason?: string;
}

export class DealerCancellationRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 1000)
  reason!: string;
}

export class DecideCancellationRequestDto {
  @IsEnum(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class ListJobsQueryDto {
  @IsOptional()
  @IsEnum([
    'pending_schedule',
    'scheduled',
    'new',
    'assigned',
    'acknowledged',
    'in_transit',
    'in_process',
    'needs_revisit',
    'revisit_scheduled',
    'completed',
    'resolved',
    'resolved_on_revisit',
    'cancellation_requested',
    'cancelled',
  ])
  status?: JobStatus;

  @IsOptional()
  @IsEnum(['installation', 'complaint'])
  type?: JobType;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsUUID()
  dealerId?: string;

  @IsOptional()
  @IsEnum(['direct', 'via_dealer'])
  source?: JobSource;

  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @IsOptional()
  @IsISO8601()
  createdTo?: string;

  @IsOptional()
  @IsISO8601()
  scheduledFrom?: string;

  @IsOptional()
  @IsISO8601()
  scheduledTo?: string;
}

export class CustomerLookupQueryDto {
  @IsOptional()
  @IsString()
  @Length(3, 32)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PendingScheduleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SchedulePendingJobDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeConflict?: boolean;
}

export class RescheduleJobDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeConflict?: boolean;
}

export class AssignTechnicianDto {
  @IsUUID()
  technicianId!: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeConflict?: boolean;
}

export class CreateOfficeTechnicianDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 120)
  password!: string;
}

export class MobileSyncPayloadDto {
  @IsOptional()
  @IsEnum([
    'pending_schedule',
    'scheduled',
    'new',
    'assigned',
    'acknowledged',
    'in_transit',
    'in_process',
    'needs_revisit',
    'revisit_scheduled',
    'completed',
    'resolved',
    'resolved_on_revisit',
    'cancellation_requested',
    'cancelled',
  ])
  targetStatus?: JobStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentAmount?: number;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  revisitReason?: string;

  @IsOptional()
  @IsString()
  customRevisitReason?: string;
}

export class MobileSyncActionDto {
  @IsString()
  @Length(3, 120)
  clientActionId!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsEnum(['status_transition', 'payment', 'status_transition+payment'])
  actionType!: 'status_transition' | 'payment' | 'status_transition+payment';

  @IsISO8601()
  queueSubmittedAt!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => MobileSyncPayloadDto)
  payload!: MobileSyncPayloadDto;
}

export class UndoJobActionDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsISO8601()
  transitionOccurredAt!: string;

  @IsOptional()
  @IsEnum([
    'pending_schedule',
    'scheduled',
    'new',
    'assigned',
    'acknowledged',
    'in_transit',
    'in_process',
    'needs_revisit',
    'revisit_scheduled',
    'completed',
    'resolved',
    'resolved_on_revisit',
    'cancellation_requested',
    'cancelled',
  ])
  revertToStatus?: JobStatus;
}

export class TriggerUnacknowledgedScanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  thresholdMins?: number;
}

export class OfficeJobsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(['installation', 'complaint'])
  type?: JobType;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  chronicOnly?: boolean;
}

export class OfficeTransitionJobDto {
  @IsString()
  @IsNotEmpty()
  toStatus!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentAmount?: number;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsEnum(['part_unavailable', 'customer_not_home', 'issue_recurring', 'further_diagnosis_required', 'custom'])
  revisitReason?: RevisitReason;

  @IsOptional()
  @IsString()
  customRevisitReason?: string;
}

export class OfficeRollbackJobDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class OfficeOverrideJobDto {
  @IsString()
  @IsNotEmpty()
  toStatus!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(['retain', 'void'])
  paymentDecision?: 'retain' | 'void';
}

export class PatchJobPaymentDto {
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class TimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ScheduleRevisitDto {
  @IsUUID()
  revisitId!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsUUID()
  technicianId!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class QuickEntryJobDto {
  @IsEnum(['installation', 'complaint'])
  type!: JobType;

  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 32)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 300)
  address!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  issueDescription?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  installationNotes?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsEnum(['auto_link', 'create_new'])
  linkBehavior?: 'auto_link' | 'create_new';

  @IsOptional()
  @IsUUID()
  selectedVcid?: string;
}

export class BrandDropdownDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;
}

export class TechnicianDropdownDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsInt()
  activeAssignments!: number;
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class BatchScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  jobIds!: string[];

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;
}
