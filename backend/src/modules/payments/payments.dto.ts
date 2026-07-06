import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export type PaymentStatus = 'pending' | 'collected' | 'refunded' | 'disputed';

export class CreatePaymentMethodDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name!: string;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name?: string;
}

export class UpdatePaymentDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;
}

export class UpdatePaymentStatusDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsEnum(['pending', 'collected', 'refunded', 'disputed'])
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class OwnerPaymentDecisionDto {
  @IsInt()
  @Min(0)
  expectedJobVersion!: number;

  @IsInt()
  @Min(0)
  expectedPaymentVersion!: number;

  @IsEnum(['retain', 'void'])
  decision!: 'retain' | 'void';

  @IsOptional()
  @IsString()
  @Length(1, 300)
  retainedNote?: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  voidReason?: string;
}
