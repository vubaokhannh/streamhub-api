import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'User full name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Full name can not exceed 100 characters' })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'abc@gmail.com',
    description: 'User email address',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;
}
