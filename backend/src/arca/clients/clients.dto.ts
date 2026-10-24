import { ClientIdType } from '../../generated/prisma/client.js';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientRequestDto {
  @IsEnum(ClientIdType) idType!: ClientIdType;
  @IsString() @IsNotEmpty() idNumber!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) fullName!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(250) address?: string;
}
