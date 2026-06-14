import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  generateAccessToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as any,
      },
    );
  }

  generateRefreshToken(
    userId: string,
    deviceId: string,
    rememberMe: boolean = false,
  ): string {
    const expiresIn = rememberMe
      ? '30d'
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
    return this.jwtService.sign(
      { sub: userId, deviceId, jti: crypto.randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: expiresIn as any,
      },
    );
  }

  getExpiresInSeconds(expiresIn: string): number {
    const amount = parseInt(expiresIn, 10);
    const unit = expiresIn.replace(amount.toString(), '').trim().toLowerCase();

    if (unit === 'd' || unit === 'day' || unit === 'days') {
      return amount * 24 * 60 * 60;
    } else if (unit === 'h' || unit === 'hour' || unit === 'hours') {
      return amount * 60 * 60;
    } else if (unit === 'm' || unit === 'minute' || unit === 'minutes') {
      return amount * 60;
    } else if (unit === 's' || unit === 'second' || unit === 'seconds') {
      return amount;
    }
    return amount;
  }

  getExpiryDate(expiresIn: string): Date {
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

  async generateTokensAndSave(
    userId: string,
    email: string,
    role: string,
    deviceId: string,
    deviceName: string,
    rememberMe: boolean = false,
  ) {
    const familyId = crypto.randomUUID();

    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.generateRefreshToken(
      userId,
      deviceId,
      rememberMe,
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

    const expiryString = rememberMe
      ? '30d'
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
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
}
