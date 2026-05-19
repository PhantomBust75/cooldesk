import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreatePlatformOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  ownerFullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ownerPasswordHash?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ownerPassword?: string;
}

export class UpdateOrganizationStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
