import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { CopywriterModule } from '../copywriter/copywriter.module';
import { GuardianModule } from '../guardian/guardian.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WebhookModule } from '../webhook/webhook.module';
import { ClassifierService } from './classifier.service';

@Module({
  imports: [
    HttpModule,
    GuardianModule,
    forwardRef(() => WebhookModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => CopywriterModule),
  ],
  providers: [ClassifierService],
  exports: [ClassifierService],
})
export class ClassifierModule {}
