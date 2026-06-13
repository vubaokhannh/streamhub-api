import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiPropertyOptional({ example: 'device-uuid-1234', description: 'Unique device identifier' })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro', description: 'Name of the device' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiPropertyOptional({ example: false, description: 'Remember me for 30 days' })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
