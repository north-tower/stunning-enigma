import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Command, Ctx, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { GuardianService } from '../guardian/guardian.service';
import { WebhookService } from '../webhook/webhook.service';
import { TelegramService } from './telegram.service';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly guardianService: GuardianService,
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => WebhookService))
    private readonly webhookService: WebhookService,
  ) {}

  @Command('stop')
  async stop(@Ctx() ctx: Context): Promise<void> {
    this.guardianService.setStatus('PAUSED');
    await this.telegramService.notifySystemStatus('PAUSED');
    await ctx.reply(
      'Agent paused. No emails will be sent until you send /start.',
    );
  }

  @Command('start')
  async start(@Ctx() ctx: Context): Promise<void> {
    this.guardianService.setStatus('ACTIVE');
    await this.telegramService.notifySystemStatus('ACTIVE');
    await ctx.reply('Agent resumed. Back to work.');
  }

  @Command('status')
  async status(@Ctx() ctx: Context): Promise<void> {
    const status = this.guardianService.isActive() ? 'ACTIVE' : 'PAUSED';
    await ctx.reply(`System: ${status}\nTime: ${new Date().toISOString()}`);
  }

  @Command('leads')
  async leads(@Ctx() ctx: Context): Promise<void> {
    try {
      const counts = await this.webhookService.getStageCounts();
      await ctx.reply(
        `Pipeline snapshot:\nInbox: ${counts.inbox}\nQualifying: ${counts.qualifying}\nProposal: ${counts.proposal}\nClosed: ${counts.closed}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to load /leads snapshot',
        error instanceof Error ? error.stack : String(error),
      );
      await ctx.reply('Unable to load lead counts right now.');
    }
  }
}
