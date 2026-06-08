import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ErrorMessages } from '../common/constants/error.constant';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName, deviceId, deviceName } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(ErrorMessages.AUTH.EMAIL_ALREADY_REGISTERED);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
      },
    });

    const activeDeviceId = deviceId || crypto.randomUUID();
    const activeDeviceName = deviceName || 'Unknown Device';

    const tokens = await this.generateTokensAndSave(
      user.id,
      user.email,
      user.role,
      activeDeviceId,
      activeDeviceName,
    );

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password, deviceId, deviceName } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt || user.status === 'BLOCKED') {
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || '');
    if (!isPasswordValid) {
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    const activeDeviceId = deviceId || crypto.randomUUID();
    const activeDeviceName = deviceName || 'Unknown Device';

    const tokens = await this.generateTokensAndSave(
      user.id,
      user.email,
      user.role,
      activeDeviceId,
      activeDeviceName,
    );

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  private async generateTokensAndSave(
    userId: string,
    email: string,
    role: string,
    deviceId: string,
    deviceName: string,
  ) {
    const familyId = crypto.randomUUID();

    const accessToken = this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as any,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, deviceId },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') as any,
      },
    );

    await this.prisma.userDevice.upsert({
      where: {
        userId_deviceId: { userId, deviceId },
      },
      create: {
        userId,
        deviceId,
        deviceName,
      },
      update: {
        deviceName,
        lastActiveAt: new Date(),
      },
    });

    const expiryString = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = this.getExpiryDate(expiryString);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        deviceId,
        familyId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private getExpiryDate(expiresIn: string): Date {
    const amount = parseInt(expiresIn, 10);
    const unit = expiresIn.replace(amount.toString(), '').trim().toLowerCase();
    const date = new Date();

    if (unit === 'd' || unit === 'day' || unit === 'days') {
      date.setDate(date.getDate() + amount);
    } else if (unit === 'h' || unit === 'hour' || unit === 'hours') {
      date.setHours(date.getHours() + amount);
    } else if (unit === 'm' || unit === 'minute' || unit === 'minutes') {
      date.setMinutes(date.getMinutes() + amount);
    } else if (unit === 's' || unit === 'second' || unit === 'seconds') {
      date.setSeconds(date.getSeconds() + amount);
    } else {
      date.setDate(date.getDate() + 7);
    }
    return date;
  }
}
