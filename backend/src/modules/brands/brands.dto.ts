import { Transform, Type } from 'class-transformer';
import { IsString, IsOptional, MinLength, MaxLength, IsNumber, Min, IsBoolean } from 'class-validator';

export class CreateBrandDto {
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'color_hex must be a string if provided' })
  @MaxLength(7, { message: 'color_hex must be at most 7 characters (e.g., #FFFFFF)' })
  @Transform(({ obj }) => obj.colorHex || obj.color_hex)
  color_hex?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'installation_charge must be a number' })
  @Min(0, { message: 'installation_charge must be >= 0' })
  @Transform(({ obj }) => obj.installationCharge ?? obj.installation_charge ?? 0)
  installation_charge?: number;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Transform(({ obj }) => obj.colorHex ?? obj.color_hex)
  color_hex?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Transform(({ obj }) => obj.installationCharge ?? obj.installation_charge)
  installation_charge?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ obj }) => obj.isActive ?? obj.is_active)
  is_active?: boolean;
}

export class BrandResponseDto {
  id!: string;
  name!: string;
  color_hex?: string;
  installation_charge!: number;
  is_active!: boolean;
  created_at!: string;
}
