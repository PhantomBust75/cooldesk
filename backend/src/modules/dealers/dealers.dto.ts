import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateDealerDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  contactName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  region?: string;

  @IsString()
  @Length(8, 120)
  password!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  brandIds?: string[];
}

export class UpdateDealerStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateDealerProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  region?: string;
}

export class UpdateDealerBrandsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  brandIds!: string[];
}

export class DealerHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
