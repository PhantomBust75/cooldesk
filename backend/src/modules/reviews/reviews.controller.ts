import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequestContext } from '../security/request-context';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { TenantGuard } from '../security/tenant.guard';
import { ReviewsListQueryDto, SubmitReviewDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

type UserRequest = {
  context: RequestContext;
};

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('jobs/:id/review-link')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff', 'technician')
  generateReviewLink(
    @Param('id') id: string,
    @Req() req: UserRequest,
  ) {
    return this.reviewsService.generateReviewLink(id, req.context);
  }

  @Post('reviews/:token')
  submitByToken(@Param('token') token: string, @Body() body: SubmitReviewDto) {
    return this.reviewsService.submitByToken(token, body);
  }

  @Get('reviews')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listSubmitted(@Query() query: ReviewsListQueryDto, @Req() req: UserRequest) {
    return this.reviewsService.listSubmitted(req.context, query.limit ?? 50);
  }

  @Get('reviews/low-rated')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('owner', 'office_staff')
  listLowRated(@Query() query: ReviewsListQueryDto, @Req() req: UserRequest) {
    return this.reviewsService.listLowRated(req.context, query.limit ?? 50);
  }
}
