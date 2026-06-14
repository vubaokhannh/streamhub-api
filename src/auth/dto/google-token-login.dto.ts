import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleTokenLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij... ',
    description: 'Google OAuth2 ID Token received from frontend client',
  })
  @IsString()
  @IsNotEmpty({ message: 'Google ID Token is required' })
  idToken: string;

  @ApiPropertyOptional({
    example: 'device-uuid-1234',
    description: 'Unique device identifier',
  })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'Chrome on macOS',
    description: 'Name of the device',
  })
  @IsString()
  @IsOptional()
  deviceName?: string;
}
