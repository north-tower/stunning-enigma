import Anthropic from '@anthropic-ai/sdk';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CopywriterService } from '../copywriter/copywriter.service';
import { GuardianService } from '../guardian/guardian.service';
import { TelegramService } from '../telegram/telegram.service';
import { Lead } from '../webhook/entities/lead.entity';
import { WebhookService } from '../webhook/webhook.service';
import { LeadClassification } from './interfaces/classification.interface';
import { LeadDossier } from './interfaces/dossier.interface';

interface DossierExtraction {
  company: string | null;
  role: string | null;
  recentNews: string | null;
  painPoint: string | null;
  toneMatch: string | null;
}

@Injectable()
export class ClassifierService {
  private readonly logger = new Logger(ClassifierService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  private readonly anthropicModel = 'claude-sonnet-4-6';
  private readonly serperSearchUrl = 'https://google.serper.dev/search';

  constructor(
    private readonly httpService: HttpService,
    private readonly guardianService: GuardianService,
    @Inject(forwardRef(() => WebhookService))
    private readonly webhookService: WebhookService,
    @Inject(forwardRef(() => CopywriterService))
    private readonly copywriterService: CopywriterService,
    private readonly telegramService: TelegramService,
  ) {}

  async buildDossier(lead: Lead): Promise<LeadDossier> {
    const snippets = await this.getSearchSnippets(lead);
    const fallback: LeadDossier = {
      name: lead.name?.trim() || lead.email?.trim() || 'Unknown Lead',
      company: null,
      role: null,
      recentNews: null,
      painPoint: null,
      toneMatch: null,
      rawSearchSnippets: snippets,
    };

    try {
      const response = await this.anthropic.messages.create({
        model: this.anthropicModel,
        max_tokens: 500,
        system:
          'You are a research assistant. Extract structured information from search results and a lead message. Always respond with valid JSON only - no preamble, no markdown.',
        messages: [
          {
            role: 'user',
            content: `Lead message: ${lead.rawMessage ?? ''}\nSearch results: ${snippets.join('\n')}\n\nExtract what you can. Return JSON exactly matching this shape:\n{\n  "company": "string or null",\n  "role": "string or null",\n  "recentNews": "one sentence about recent company news, or null",\n  "painPoint": "inferred pain point from their message, or null",\n  "toneMatch": "Direct" | "Friendly" | "Formal" | "Casual"\n}`,
          },
        ],
      });

      const text = this.extractTextFromResponse(response);
      const parsed = this.safeParseJson<DossierExtraction>(text);

      if (!parsed) {
        return fallback;
      }

      return {
        ...fallback,
        company: this.toNullableString(parsed.company),
        role: this.toNullableString(parsed.role),
        recentNews: this.toNullableString(parsed.recentNews),
        painPoint: this.toNullableString(parsed.painPoint),
        toneMatch: this.toNullableString(parsed.toneMatch),
      };
    } catch (error) {
      this.logger.error(
        `Claude dossier generation failed for lead ${lead.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return fallback;
    }
  }

  async classifyLead(
    lead: Lead,
    dossier: LeadDossier,
  ): Promise<LeadClassification> {
    const fallback: LeadClassification = {
      intentType: 'Service Interest',
      priority: 'P2',
      reasoning: 'Classifier unavailable; defaulting to lowest-risk triage.',
      suggestedAction: 'Review manually in inbox.',
    };

    try {
      const response = await this.anthropic.messages.create({
        model: this.anthropicModel,
        max_tokens: 500,
        system:
          'You are a sales intelligence assistant. You classify inbound lead messages using a strict 7-point matrix. Always respond with valid JSON only - no preamble, no markdown.',
        messages: [
          {
            role: 'user',
            content: `Lead message: ${lead.rawMessage ?? ''}\nDossier: ${JSON.stringify(dossier)}\n\nClassify this lead. Return JSON exactly matching this shape:\n{\n  "intentType": "Buyer" | "Call Request" | "Product Inquiry" | "Service Interest" | "Support" | "Networking" | "Spam/Sales",\n  "priority": "P0" | "P1" | "P2" | "P3",\n  "reasoning": "one sentence explaining the classification",\n  "suggestedAction": "one sentence describing the next action"\n}`,
          },
        ],
      });

      const text = this.extractTextFromResponse(response);
      const parsed = this.safeParseJson<LeadClassification>(text);

      if (!parsed) {
        return fallback;
      }

      return {
        intentType: this.normalizeIntentType(parsed.intentType),
        priority: this.normalizePriority(parsed.priority),
        reasoning:
          this.toNullableString(parsed.reasoning) ??
          fallback.reasoning,
        suggestedAction:
          this.toNullableString(parsed.suggestedAction) ??
          fallback.suggestedAction,
      };
    } catch (error) {
      this.logger.error(
        `Claude classification failed for lead ${lead.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return fallback;
    }
  }

  async processLead(leadId: string): Promise<void> {
    try {
      this.guardianService.assertActive();
      const lead = await this.webhookService.findById(leadId);
      if (!lead) {
        this.logger.warn(`Lead ${leadId} not found for classification`);
        return;
      }

      const dossier = await this.buildDossier(lead);
      const classification = await this.classifyLead(lead, dossier);
      const stage = classification.priority === 'P0' || classification.priority === 'P1'
        ? 'qualifying'
        : 'inbox';

      await this.webhookService.updateLeadClassification(lead.id, {
        metadata: {
          ...(lead.metadata ?? {}),
          dossier,
          classification,
        },
        priority: classification.priority,
        stage,
      });

      setImmediate(() => {
        this.copywriterService.processDraft(lead.id).catch((error: unknown) => {
          this.logger.error(
            `Background draft processing failed for ${lead.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SYSTEM_PAUSED') {
        this.logger.log(`Lead ${leadId} skipped because system is paused`);
        return;
      }

      if (error instanceof Error) {
        await this.telegramService.notifyError('ClassifierService', error);
      }

      this.logger.error(
        `Lead processing failed for ${leadId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async getSearchSnippets(lead: Lead): Promise<string[]> {
    const query = this.buildSearchQuery(lead);

    if (!query) {
      return [];
    }

    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
      this.logger.warn('Serper API key is missing');
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          organic?: Array<{ snippet?: string }>;
        }>(
          this.serperSearchUrl,
          {
            q: query,
            num: 3,
          },
          {
            headers: {
              'X-API-KEY': apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return (response.data.organic ?? [])
        .map((item) => item.snippet?.trim() ?? '')
        .filter((snippet) => snippet.length > 0)
        .slice(0, 3);
    } catch (error) {
      this.logger.warn(
        `Serper search failed for lead ${lead.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private buildSearchQuery(lead: Lead): string | null {
    const name = lead.name?.trim() ?? '';
    const domain = this.getEmailDomain(lead.email);
    const company = domain ? domain.split('.')[0] : '';
    const query = `${name} ${company}`.trim();

    return query.length > 0 ? query : null;
  }

  private getEmailDomain(email?: string | null): string {
    if (!email || !email.includes('@')) {
      return '';
    }

    return email.split('@')[1]?.toLowerCase().trim() ?? '';
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

  private toNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private normalizeIntentType(value: unknown): LeadClassification['intentType'] {
    const allowed: LeadClassification['intentType'][] = [
      'Buyer',
      'Call Request',
      'Product Inquiry',
      'Service Interest',
      'Support',
      'Networking',
      'Spam/Sales',
    ];

    return allowed.includes(value as LeadClassification['intentType'])
      ? (value as LeadClassification['intentType'])
      : 'Service Interest';
  }

  private normalizePriority(value: unknown): LeadClassification['priority'] {
    return value === 'P0' || value === 'P1' || value === 'P2' || value === 'P3'
      ? value
      : 'P2';
  }
}
