import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
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
  private readonly logger = new Logger(WebhookController.name);

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
    @Body() dto: CreateLeadDto | any,
  ): Promise<{ received: true; leadId: string }> {
    if (!incomingSecret || incomingSecret !== process.env.WEBHOOK_SECRET) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (dto?.data?.fields) {
      this.logger.log(
        `[Tally] webhook received on /webhook/lead responseId=${dto?.data?.responseId ?? 'unknown'} fields=${Array.isArray(dto?.data?.fields) ? dto.data.fields.length : 0}`,
      );
      const normalized = this.webhookService.normalizePayload(dto, 'tally');
      this.logger.log(
        `[Tally] normalized name=${normalized.name ?? 'null'} email=${normalized.email ?? 'null'} rawMessage=${normalized.rawMessage ? 'present' : 'null'}`,
      );
      const lead = await this.webhookService.createLeadFromNormalized(normalized);
      this.logger.log(`[Tally] lead created id=${lead.id}`);
      return {
        received: true,
        leadId: lead.id,
      };
    }

    const lead = await this.webhookService.createLead(dto as CreateLeadDto);

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

    this.logger.log(
      `[Tally] webhook received responseId=${body?.data?.responseId ?? 'unknown'} fields=${Array.isArray(body?.data?.fields) ? body.data.fields.length : 0}`,
    );
    if (Array.isArray(body?.data?.fields)) {
      this.logger.log(
        `[Tally] raw fields: ${JSON.stringify(
          body.data.fields.map((f: any) => ({
            label: f?.label ?? null,
            type: f?.type ?? null,
            value: f?.value ?? null,
          })),
        )}`,
      );
    }

    const normalized = this.webhookService.normalizePayload(body, 'tally');
    this.logger.log(
      `[Tally] normalized name=${normalized.name ?? 'null'} email=${normalized.email ?? 'null'} rawMessage=${normalized.rawMessage ? 'present' : 'null'}`,
    );
    const lead = await this.webhookService.createLeadFromNormalized(normalized);
    this.logger.log(`[Tally] lead created id=${lead.id}`);
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
