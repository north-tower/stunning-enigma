import { Module, forwardRef } from '@nestjs/common';
import { GuardianModule } from '../guardian/guardian.module';
import { MailerModule } from '../mailer/mailer.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WebhookModule } from '../webhook/webhook.module';
import { CopywriterController } from './copywriter.controller';
import { CopywriterService } from './copywriter.service';

@Module({
  imports: [
    MailerModule,
    GuardianModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => WebhookModule),
  ],
  controllers: [CopywriterController],
  providers: [CopywriterService],
  exports: [CopywriterService],
})
export class CopywriterModule {}
