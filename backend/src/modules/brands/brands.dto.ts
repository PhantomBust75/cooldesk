import { Transform, Type } from 'class-transformer';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

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
}

export class BrandResponseDto {
  id!: string;
  name!: string;
  color_hex?: string;
  installation_charge!: number;
  is_active!: boolean;
  created_at!: string;
}
