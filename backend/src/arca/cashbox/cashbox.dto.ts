import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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

export class PoolDto {
  @IsString() @IsNotEmpty() @MaxLength(20) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
}

export class CashboxDto {
  @IsString() @IsNotEmpty() @MaxLength(20) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional()
  @IsInt()
  poolId?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class OpenSessionDto {
  @IsInt() cashboxId!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999_999_999_999) openingFloat!: number;
}

export class CountLineDto {
  @IsInt() denomination!: number;
  @IsInt() @Min(0) @Max(1_000_000) quantity!: number;
}

export class CloseSessionDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  counts!: CountLineDto[];

  @IsOptional() @IsString() @MaxLength(500) justification?: string;
}
