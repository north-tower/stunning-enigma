import Anthropic from '@anthropic-ai/sdk';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { GuardianService } from '../guardian/guardian.service';
import { MailerService } from '../mailer/mailer.service';
import { TelegramService } from '../telegram/telegram.service';
import { Lead } from '../webhook/entities/lead.entity';
import { WebhookService } from '../webhook/webhook.service';
import { EmailDraft } from './interfaces/email-draft.interface';

@Injectable()
export class CopywriterService {
  private readonly logger = new Logger(CopywriterService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  private readonly anthropicModel = 'claude-sonnet-4-6';
  private readonly autoSendMinConfidence = this.getAutoSendMinConfidence();

  constructor(
    private readonly guardianService: GuardianService,
    @Inject(forwardRef(() => WebhookService))
    private readonly webhookService: WebhookService,
    private readonly mailerService: MailerService,
    private readonly telegramService: TelegramService,
  ) {}

  async generateDraft(lead: Lead): Promise<EmailDraft> {
    const dossier = (lead.metadata?.dossier ?? {}) as Record<string, unknown>;
    const framework = this.resolveFramework(lead.priority);

    const response = await this.anthropic.messages.create({
      model: this.anthropicModel,
      max_tokens: 700,
      system:
        'You are an expert B2B sales copywriter. You write short, human, non-salesy emails that get replies. Always respond with valid JSON only - no preamble, no markdown fences.',
      messages: [
        {
          role: 'user',
          content: `Write a sales email for this lead.\n\nLead info:\n- Name: ${lead.name ?? ''}\n- Raw message: ${lead.rawMessage ?? ''}\n- Company: ${this.valueOrNull(dossier.company)}\n- Role: ${this.valueOrNull(dossier.role)}\n- Pain point: ${this.valueOrNull(dossier.painPoint)}\n- Recent news: ${this.valueOrNull(dossier.recentNews)}\n- Tone match: ${this.valueOrNull(dossier.toneMatch)}\n- Priority: ${lead.priority ?? 'P2'}\n- Framework to use: ${framework}\n\nFramework guidance:\nPAS: Open with their Problem. Agitate it (make it real). Present your Solution. Be direct.\nBAB: Paint the Before (current struggle). Show the After (transformation). Bridge with how you get them there.\n\nConstraints:\n- Max 4 sentences in the body\n- No subject lines like "Quick question" or "Following up"\n- No words like "synergy", "leverage", "touch base"\n- Write like a busy founder, not a marketing bot\n- End with one soft CTA (a question or a time offer)\n\nRate your own confidence that this email will get a reply, from 0 to 100.\nConsider: specificity of pain point, quality of news hook, clarity of CTA.\n\nReturn JSON exactly matching this shape:\n{\n  "subject": "string",\n  "body": "string",\n  "confidenceScore": number,\n  "framework": "PAS" | "BAB",\n  "reasoning": "one sentence on why you rated it this confidence score"\n}`,
        },
      ],
    });

    const text = this.extractTextFromResponse(response);
    const parsed = this.safeParseJson<Partial<EmailDraft>>(text);

    if (!parsed) {
      throw new Error('Failed to parse Claude draft JSON');
    }

    const normalizedFramework =
      parsed.framework === 'PAS' || parsed.framework === 'BAB'
        ? parsed.framework
        : framework;

    return {
      subject: this.toStringOrFallback(parsed.subject, 'Quick note on your goals'),
      body: this.toStringOrFallback(
        parsed.body,
        'Thanks for reaching out. Happy to share more context and next steps. Would a quick call this week be useful?',
      ),
      confidenceScore:
        typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0,
      framework: normalizedFramework,
      reasoning: this.toStringOrFallback(
        parsed.reasoning,
        'Insufficient structured output to justify higher confidence.',
      ),
    };
  }

  scoreDraft(draft: EmailDraft): number {
    return Number.isFinite(draft.confidenceScore) ? draft.confidenceScore : 0;
  }

  async processDraft(leadId: string): Promise<void> {
    try {
      this.guardianService.assertActive();
      const lead = await this.webhookService.findById(leadId);
      if (!lead) {
        this.logger.warn(`Lead ${leadId} not found for draft processing`);
        return;
      }

      if (lead.emailSent) {
        return;
      }

      if (lead.priority === 'P3') {
        await this.webhookService.updateLeadById(lead.id, {
          stage: 'dead',
          reviewQueued: false,
          emailSent: false,
        });
        return;
      }

      let draft: EmailDraft;

      try {
        draft = await this.generateDraft(lead);
      } catch (error) {
        this.logger.error(
          `Draft generation failed for lead ${lead.id}`,
          error instanceof Error ? error.stack : String(error),
        );
        await this.webhookService.updateLeadById(lead.id, {
          reviewQueued: true,
        });
        return;
      }

      const score = this.scoreDraft(draft);
      const nextMetadata = {
        ...(lead.metadata ?? {}),
        draft,
      };
      const canAutoSend = score >= this.autoSendMinConfidence;
      const hasRecipient = typeof lead.email === 'string' && lead.email.length > 0;

      if (canAutoSend && hasRecipient) {
        try {
          await this.mailerService.send(lead.email, draft.subject, draft.body);
          await this.webhookService.updateLeadById(lead.id, {
            metadata: nextMetadata,
            confidenceScore: score,
            emailSubject: draft.subject,
            emailBody: draft.body,
            emailSent: true,
            emailSentAt: new Date(),
            reviewQueued: false,
            stage: 'qualifying',
          });
          if (lead.priority === 'P0' || lead.priority === 'P1') {
            await this.telegramService.notifyP0Lead(lead);
          }
          return;
        } catch (error) {
          this.logger.error(
            `Email delivery failed for lead ${lead.id}`,
            error instanceof Error ? error.stack : String(error),
          );
          await this.webhookService.updateLeadById(lead.id, {
            metadata: nextMetadata,
            confidenceScore: score,
            emailSubject: draft.subject,
            emailBody: draft.body,
            reviewQueued: true,
          });
          await this.telegramService.notifyQueuedDraft(lead, score);
          return;
        }
      }

      if (!hasRecipient) {
        this.logger.warn(
          `Lead ${lead.id} has no email address; queued for review`,
        );
      } else if (!canAutoSend) {
        this.logger.log(
          `Lead ${lead.id} queued for review - confidence ${score} below threshold ${this.autoSendMinConfidence}`,
        );
      }

      await this.webhookService.updateLeadById(lead.id, {
        metadata: nextMetadata,
        confidenceScore: score,
        emailSubject: draft.subject,
        emailBody: draft.body,
        reviewQueued: true,
      });
      await this.telegramService.notifyQueuedDraft(lead, score);
    } catch (error) {
      if (error instanceof Error && error.message === 'SYSTEM_PAUSED') {
        this.logger.log(`Lead ${leadId} skipped because system is paused`);
        return;
      }

      if (error instanceof Error) {
        await this.telegramService.notifyError('CopywriterService', error);
      }

      this.logger.error(
        `Draft processing failed for lead ${leadId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async approveQueuedDraft(leadId: string): Promise<void> {
    const lead = await this.webhookService.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const draft = (lead.metadata?.draft ?? null) as EmailDraft | null;
    if (!draft || !lead.email) {
      throw new Error('Cannot approve draft without recipient and draft content');
    }

    await this.mailerService.send(lead.email, draft.subject, draft.body);

    await this.webhookService.updateLeadById(lead.id, {
      emailSubject: draft.subject,
      emailBody: draft.body,
      confidenceScore: draft.confidenceScore ?? lead.confidenceScore ?? null,
      emailSent: true,
      emailSentAt: new Date(),
      reviewQueued: false,
    });
  }

  async rejectQueuedDraft(leadId: string): Promise<void> {
    const lead = await this.webhookService.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    await this.webhookService.updateLeadById(lead.id, {
      reviewQueued: false,
      stage: 'dead',
    });
  }

  async updateDraft(leadId: string, subject: string, body: string): Promise<void> {
    const lead = await this.webhookService.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const existingDraft = (lead.metadata?.draft ?? {}) as Partial<EmailDraft>;
    const metadata = {
      ...(lead.metadata ?? {}),
      draft: {
        subject,
        body,
        confidenceScore: existingDraft.confidenceScore ?? lead.confidenceScore ?? 0,
        framework: existingDraft.framework ?? this.resolveFramework(lead.priority),
        reasoning:
          existingDraft.reasoning ?? 'Draft manually edited in dashboard.',
      },
    };

    await this.webhookService.updateLeadById(lead.id, {
      metadata,
      emailSubject: subject,
      emailBody: body,
    });
  }

  private resolveFramework(priority?: Lead['priority'] | null): EmailDraft['framework'] {
    if (priority === 'P0') {
      return 'PAS';
    }

    return 'BAB';
  }

  private extractTextFromResponse(response: Anthropic.Messages.Message): string {
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  private safeParseJson<T>(raw: string): T | null {
    if (!raw) {
      return null;
    }

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }

  private valueOrNull(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : 'null';
  }

  private toStringOrFallback(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : fallback;
  }

  private getAutoSendMinConfidence(): number {
    const raw = process.env.AUTO_SEND_MIN_CONFIDENCE;
    const parsed = Number(raw);

    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }

    return 90;
  }
}
