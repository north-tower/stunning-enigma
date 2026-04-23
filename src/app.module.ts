import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClassifierModule } from './classifier/classifier.module';
import { CopywriterModule } from './copywriter/copywriter.module';
import { GuardianModule } from './guardian/guardian.module';
import { MailerModule } from './mailer/mailer.module';
import { TelegramModule } from './telegram/telegram.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ??
        'postgresql://user1:password@localhost:5433/play',
      autoLoadEntities: true,
      synchronize: false,
    }),
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_TOKEN ?? '',
    }),
    GuardianModule,
    TelegramModule,
    MailerModule,
    CopywriterModule,
    ClassifierModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}