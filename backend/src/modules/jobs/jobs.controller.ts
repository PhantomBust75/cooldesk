import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DealerGuard } from '../security/dealer.guard';
import { RequestContext, DealerRequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import {
  CreateJobDto,
  AssignTechnicianDto,
  CreateOfficeTechnicianDto,
  CustomerLookupQueryDto,
  DecideCancellationRequestDto,
  DealerCancellationRequestDto,
  ListJobsQueryDto,
  MobileSyncActionDto,
  PendingScheduleQueryDto,
  QuickEntryJobDto,
  RescheduleJobDto,
  SchedulePendingJobDto,
  ScheduleRevisitDto,
  TriggerUnacknowledgedScanDto,
  UndoJobActionDto,
  UpdateJobStatusDto,
} from './jobs.dto';
import { JobsService } from './jobs.service';

type UserRequest = {
  context: RequestContext;
};

type DealerRequest = {
  dealerContext: DealerRequestContext;
};

@Controller()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('jobs')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  createJobByUser(@Body() body: CreateJobDto, @Req() req: UserRequest) {
    return this.jobsService.createByUser(body, req.context);
  }

  @Post('dealer/jobs')
  @UseGuards(DealerGuard)
  createJobByDealer(@Body() body: CreateJobDto, @Req() req: DealerRequest) {
    return this.jobsService.createByDealer(body, req.dealerContext);
  }

  @Get('jobs/:id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  getJob(@Param('id') id: string, @Req() req: UserRequest) {
    return this.jobsService.findById(id, req.context);
  }

  @Get('jobs')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  listJobs(@Query() query: ListJobsQueryDto, @Req() req: UserRequest) {
    return this.jobsService.listJobs(query, req.context);
  }

  @Get('office/customers/lookup')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  lookupCustomers(@Query() query: CustomerLookupQueryDto, @Req() req: UserRequest) {
    return this.jobsService.lookupCustomers(query, req.context);
  }

  @Get('office/jobs/pending-schedule')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listPendingSchedule(@Query() query: PendingScheduleQueryDto, @Req() req: UserRequest) {
    return this.jobsService.listPendingScheduleJobs(query, req.context);
  }

  @Post('office/jobs/:id/schedule')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  schedulePendingJob(
    @Param('id') id: string,
    @Body() body: SchedulePendingJobDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.schedulePendingJob(id, body, req.context);
  }

  @Get('office/technicians/workload')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  getTechnicianWorkload(@Req() req: UserRequest) {
    return this.jobsService.getTechnicianWorkload(req.context);
  }

  @Post('office/jobs/quick-entry')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  quickEntryCreateJob(@Body() body: QuickEntryJobDto, @Req() req: UserRequest) {
    return this.jobsService.quickEntryCreateJob(body, req.context);
  }

  @Get('office/technicians')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listOfficeTechnicians(@Req() req: UserRequest) {
    return this.jobsService.listTechniciansForOffice(req.context);
  }

  @Post('office/technicians')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner')
  createOfficeTechnician(@Body() body: CreateOfficeTechnicianDto, @Req() req: UserRequest) {
    return this.jobsService.createOfficeTechnician(body, req.context);
  }

  @Get('office/revisits/pending')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listPendingRevisitCards(@Req() req: UserRequest) {
    return this.jobsService.listPendingRevisitCards(req.context);
  }

  @Patch('office/jobs/:id/reschedule')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  rescheduleJob(
    @Param('id') id: string,
    @Body() body: RescheduleJobDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.rescheduleJob(id, body, req.context);
  }

  @Patch('jobs/:id/status')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  patchStatus(@Param('id') id: string, @Body() body: UpdateJobStatusDto, @Req() req: UserRequest) {
    return this.jobsService.updateStatus(id, body, req.context);
  }

  @Post('dealer/jobs/:id/withdraw')
  @UseGuards(DealerGuard)
  withdrawDealerJob(
    @Param('id') id: string,
    @Body() body: DealerCancellationRequestDto,
    @Req() req: DealerRequest,
  ) {
    return this.jobsService.dealerWithdrawInitialJob(id, body.reason, req.dealerContext);
  }

  @Post('dealer/jobs/:id/cancellation-request')
  @UseGuards(DealerGuard)
  requestDealerCancellation(
    @Param('id') id: string,
    @Body() body: DealerCancellationRequestDto,
    @Req() req: DealerRequest,
  ) {
    return this.jobsService.requestDealerCancellation(id, body.reason, req.dealerContext);
  }

  @Patch('jobs/:id/cancellation-request')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  decideCancellationRequest(
    @Param('id') id: string,
    @Body() body: DecideCancellationRequestDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.decideCancellationRequest(id, body, req.context);
  }

  @Post('jobs/:id/assign')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  assignTechnician(
    @Param('id') id: string,
    @Body() body: AssignTechnicianDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.assignTechnician(
      id,
      body.technicianId,
      body.acknowledgeConflict ?? false,
      req.context,
    );
  }

  @Post('jobs/:id/reassign')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  reassignTechnician(
    @Param('id') id: string,
    @Body() body: AssignTechnicianDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.reassignTechnician(
      id,
      body.technicianId,
      body.acknowledgeConflict ?? false,
      req.context,
    );
  }

  @Post('jobs/:id/acknowledge')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('technician')
  acknowledgeJob(@Param('id') id: string, @Req() req: UserRequest) {
    return this.jobsService.acknowledgeJob(id, req.context);
  }

  @Get('technician/jobs')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('technician')
  getTechnicianMyJobs(@Req() req: UserRequest) {
    return this.jobsService.getTechnicianMyJobs(req.context);
  }

  @Post('jobs/:id/mobile-sync')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('technician')
  syncTechnicianAction(
    @Param('id') id: string,
    @Body() body: MobileSyncActionDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.syncTechnicianAction(id, body, req.context);
  }

  @Post('jobs/:id/undo')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('technician')
  undoTechnicianAction(
    @Param('id') id: string,
    @Body() body: UndoJobActionDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.undoTechnicianAction(id, body, req.context);
  }

  @Post('internal/jobs/no-show-scan')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  runNoShowScan(@Req() req: UserRequest) {
    return this.jobsService.detectNoShows(req.context);
  }

  @Post('internal/jobs/unacknowledged-scan')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  runUnacknowledgedScan(
    @Body() body: TriggerUnacknowledgedScanDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.detectUnacknowledgedAssignments(req.context, body.thresholdMins ?? 30);
  }

  @Post('jobs/:id/revisit-schedule')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  scheduleRevisit(
    @Param('id') id: string,
    @Body() body: ScheduleRevisitDto,
    @Req() req: UserRequest,
  ) {
    return this.jobsService.scheduleRevisit(id, body, req.context);
  }
}
