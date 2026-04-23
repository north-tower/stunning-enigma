import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { Lead } from '../webhook/entities/lead.entity';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;
  private readonly bot: Telegraf | null;

  constructor() {
    this.bot = this.botToken ? new Telegraf(this.botToken) : null;
  }

  async notify(message: string): Promise<void> {
    if (!this.bot || !this.chatId) {
      return;
    }

    const timestamp = new Date().toISOString().slice(11, 16);
    const payload = `[${timestamp}] ${message}`;

    try {
      await this.bot.telegram.sendMessage(this.chatId, payload);
    } catch (error) {
      this.logger.error(
        'Telegram notification failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async notifyP0Lead(lead: Lead): Promise<void> {
    const preview = (lead.rawMessage ?? '').slice(0, 120);
    await this.notify(
      `P0 LEAD - ${lead.name ?? 'Unknown'} (${lead.email ?? 'no-email'})\nSource: ${lead.source ?? 'unknown'}\nMessage: ${preview}...\nAction: Email auto-sending now.`,
    );
  }

  async notifyQueuedDraft(lead: Lead, score: number): Promise<void> {
    await this.notify(
      `DRAFT QUEUED - ${lead.name ?? 'Unknown'}\nConfidence: ${score}/100 (below threshold)\nAction: Review needed. Check approval queue.`,
    );
  }

  async notifyError(context: string, error: Error): Promise<void> {
    await this.notify(
      `AGENT ERROR - ${context}\n${error.message}\nAction: Check logs.`,
    );
  }

  async notifySystemStatus(status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    const action =
      status === 'ACTIVE'
        ? 'Resuming normal operation.'
        : 'No emails will be sent.';
    await this.notify(
      `SYSTEM ${status}\nAgent is now ${
        status === 'ACTIVE' ? 'running' : 'paused'
      }.\n${action}`,
    );
  }
}
