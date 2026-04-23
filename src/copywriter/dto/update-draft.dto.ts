import { IsString } from 'class-validator';

export class UpdateDraftDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;
}
