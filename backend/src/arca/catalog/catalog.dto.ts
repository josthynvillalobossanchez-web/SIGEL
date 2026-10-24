import { ConceptType, Periodicity } from '../../generated/prisma/client.js';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConceptDto {
  @IsString() @IsNotEmpty() @MaxLength(20) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @IsEnum(ConceptType) type!: ConceptType;
  @IsEnum(Periodicity) periodicity!: Periodicity;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'La tarifa no puede ser negativa.' })
  @Max(999_999_999_999)
  price!: number;
  @IsBoolean() active!: boolean;
}
