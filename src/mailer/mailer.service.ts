import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  async send(to: string, subject: string, body: string): Promise<void> {
    const from = process.env.MAIL_FROM;

    if (!from) {
      throw new Error('MAIL_FROM is not configured');
    }

    try {
      await this.resend.emails.send({
        from,
        to,
        subject,
        text: body,
      });
    } catch (error) {
      this.logger.error(
        `Failed sending email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
