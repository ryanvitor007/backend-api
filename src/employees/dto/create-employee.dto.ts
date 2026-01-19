import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  cpf: string;

  @IsOptional()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip_code?: string;

  @IsNotEmpty()
  @IsString()
  cnh: string;

  @IsOptional()
  @IsString()
  cnh_category?: string;

  @IsOptional()
  @IsDateString()
  cnh_expiry?: string;

  @IsOptional()
  @IsBoolean()
  mopp?: boolean;

  @IsOptional()
  @IsDateString()
  mopp_expiry?: string;

  @IsOptional()
  @IsDateString()
  admission_date?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
