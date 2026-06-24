import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateServiceItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['fixed', 'variable'])
  pricingType!: 'fixed' | 'variable';

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  unitLabel?: string;
}

export class UpdateServiceItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(['fixed', 'variable'])
  pricingType?: 'fixed' | 'variable';

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  unitLabel?: string;
}
