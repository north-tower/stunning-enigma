import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  Param,
  Patch,
  Get,
} from '@nestjs/common';
import { GuardianService } from '../guardian/guardian.service';
import { TelegramService } from '../telegram/telegram.service';
import { CopywriterService } from './copywriter.service';
import { UpdateDraftDto } from './dto/update-draft.dto';

@Controller()
export class CopywriterController {
  constructor(
    private readonly copywriterService: CopywriterService,
    private readonly guardianService: GuardianService,
    private readonly telegramService: TelegramService,
  ) {}

  private assertDashboardApiKey(incomingApiKey: string | undefined): void {
    const expectedApiKey = process.env.DASHBOARD_API_KEY;
    if (!expectedApiKey || !incomingApiKey || incomingApiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid dashboard API key');
    }
  }

  @Post('/leads/:id/approve')
  @HttpCode(200)
  async approveLeadDraft(
    @Param('id') id: string,
    @Headers('x-api-key') incomingApiKey: string | undefined,
  ): Promise<{ success: true }> {
    this.assertDashboardApiKey(incomingApiKey);
    await this.copywriterService.approveQueuedDraft(id);
    return { success: true };
  }

  @Post('/leads/:id/reject')
  @HttpCode(200)
  async rejectLeadDraft(
    @Param('id') id: string,
    @Headers('x-api-key') incomingApiKey: string | undefined,
  ): Promise<{ success: true }> {
    this.assertDashboardApiKey(incomingApiKey);
    await this.copywriterService.rejectQueuedDraft(id);
    return { success: true };
  }

  @Patch('/leads/:id/draft')
  async updateLeadDraft(
    @Param('id') id: string,
    @Headers('x-api-key') incomingApiKey: string | undefined,
    @Body() dto: UpdateDraftDto,
  ): Promise<{ success: true }> {
    this.assertDashboardApiKey(incomingApiKey);
    await this.copywriterService.updateDraft(id, dto.subject, dto.body);
    return { success: true };
  }

  @Get('/system/status')
  getSystemStatus(): { status: 'ACTIVE' | 'PAUSED' } {
    return {
      status: process.env.SYSTEM_STATUS === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    };
  }

  @Post('/system/toggle')
  async toggleSystemStatus(
    @Headers('x-api-key') incomingApiKey: string | undefined,
  ): Promise<{ status: 'ACTIVE' | 'PAUSED' }> {
    this.assertDashboardApiKey(incomingApiKey);
    const nextStatus =
      process.env.SYSTEM_STATUS === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.guardianService.setStatus(nextStatus);
    await this.telegramService.notifySystemStatus(nextStatus);
    return { status: nextStatus };
  }
}
