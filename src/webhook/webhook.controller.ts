import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { WebhookService } from './webhook.service';

@Controller()
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  private assertDashboardApiKey(incomingApiKey: string | undefined): void {
    const expectedApiKey = process.env.DASHBOARD_API_KEY;
    if (!expectedApiKey || !incomingApiKey || incomingApiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid dashboard API key');
    }
  }

  @Post('/webhook/lead')
  @HttpCode(200)
  async receiveLead(
    @Headers('x-webhook-secret') incomingSecret: string | undefined,
    @Body() dto: CreateLeadDto,
  ): Promise<{ received: true; leadId: string }> {
    if (!incomingSecret || incomingSecret !== process.env.WEBHOOK_SECRET) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const lead = await this.webhookService.createLead(dto);

    return {
      received: true,
      leadId: lead.id,
    };
  }

  @Post('/webhook/typeform')
  @HttpCode(200)
  async receiveTally(
    @Body() body: any,
    @Headers('x-webhook-secret') secret: string | undefined,
  ): Promise<{ received: true; leadId: string }> {
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const normalized = this.webhookService.normalizePayload(body, 'tally');
    const lead = await this.webhookService.createLeadFromNormalized(normalized);
    return { received: true, leadId: lead.id };
  }

  @Get('/leads')
  async getLeads() {
    return this.webhookService.findAll();
  }

  @Get('/leads/queue')
  async getQueue() {
    return this.webhookService.findQueue();
  }

  @Get('/leads/:id')
  async getLead(@Param('id') id: string) {
    const lead = await this.webhookService.findById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  @Patch('/leads/:id/stage')
  async updateLeadStage(
    @Param('id') id: string,
    @Headers('x-api-key') incomingApiKey: string | undefined,
    @Body() dto: UpdateStageDto,
  ) {
    this.assertDashboardApiKey(incomingApiKey);
    const lead = await this.webhookService.updateStage(id, dto.stage);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }
}
