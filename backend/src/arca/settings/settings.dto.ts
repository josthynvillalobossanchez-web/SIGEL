import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

export class SettingsDto {
  @IsString()
  @MaxLength(60)
  municipalLegalId!: string;

  @IsString() @MaxLength(60) municipalPhone!: string;
  @IsString() @MaxLength(200) municipalAddress!: string;

  @IsIn(['TERMICO', 'CARTA'])
  printFormat!: 'TERMICO' | 'CARTA';

  @IsBoolean() autoPrint!: boolean;
}
