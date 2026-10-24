import { VoidReason } from '../../generated/prisma/client.js';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MONEY = { maxDecimalPlaces: 2 } as const;
const MAX = 999_999_999_999;

export class LineDto {
  @IsInt() conceptId!: number;
  @IsInt() @Min(1, { message: 'La cantidad debe ser mayor a cero.' }) @Max(100_000) quantity!: number;
  @IsNumber(MONEY) @Min(0) @Max(MAX) unitAmount!: number;
  @IsOptional() @IsNumber(MONEY) @Min(0) @Max(MAX) discount?: number;
  @IsOptional() @IsNumber(MONEY) @Min(0) @Max(MAX) surcharge?: number;
}

export class PaymentsDto {
  @IsOptional() @IsNumber(MONEY) @Min(0) @Max(MAX) card?: number;
  @IsOptional() @IsNumber(MONEY) @Min(0) @Max(MAX) sinpe?: number;
  @IsOptional() @IsNumber(MONEY) @Min(0) @Max(MAX) transfer?: number;
  @IsNumber(MONEY) @Min(0) @Max(MAX) cashReceived!: number;
}

export class CreateReceiptDto {
  @IsOptional() @IsInt() clientId?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'El recibo debe tener al menos un concepto.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];

  @ValidateNested()
  @Type(() => PaymentsDto)
  payments!: PaymentsDto;
}

export class VoidDto {
  @IsEnum(VoidReason) reason!: VoidReason;
  @IsString()
  @IsNotEmpty({ message: 'Escriba el detalle del motivo para continuar.' })
  @MaxLength(500)
  detail!: string;
  @IsString() @IsNotEmpty() @MaxLength(60) supervisorUsername!: string;
  @IsString() @IsNotEmpty() @MaxLength(72) supervisorPassword!: string;
}
