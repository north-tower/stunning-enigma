import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Minimal valid example:
 * { "source": "manual", "message": "Interested in pricing" }
 */
export class CreateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  source?: 'typeform' | 'gmail' | 'linkedin' | 'manual';

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
