import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ErrorMessages } from '../common/constants/error.constant';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private tokenService: TokenService,
  ) { }

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

    const tokens = await this.tokenService.generateTokensAndSave(
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
    const { email, password, deviceId, deviceName, rememberMe } = loginDto;

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

    const tokens = await this.tokenService.generateTokensAndSave(
      user.id,
      user.email,
      user.role,
      activeDeviceId,
      activeDeviceName,
      rememberMe,
    );

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: {
        id: true,
        token: true,
        userId: true,
        deviceId: true,
        familyId: true,
        expiresAt: true,
        isRevoked: true,
        replacedByToken: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    if (tokenRecord.replacedByToken) {
      throw new UnauthorizedException(
        ErrorMessages.AUTH.REFRESH_TOKEN_REUSED,
      );
    }

    if (tokenRecord.isRevoked) {
      throw new UnauthorizedException(
        ErrorMessages.AUTH.REFRESH_TOKEN_REVOKED,
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException(ErrorMessages.AUTH.REFRESH_TOKEN_EXPIRED);
    }

    const { user, deviceId, familyId } = tokenRecord;

    if (!user || user.deletedAt || user.status === 'BLOCKED') {
      throw new UnauthorizedException(ErrorMessages.AUTH.USER_BLOCKED);
    }

    const newAccessToken = this.tokenService.generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = this.tokenService.generateRefreshToken(user.id, deviceId);

    const expiryString = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
    const newExpiresAt = this.tokenService.getExpiryDate(expiryString);

    await this.prisma.$transaction(async (tx) => {
      // Revoke the old refresh token atomically to prevent race conditions
      const updateResult = await tx.refreshToken.updateMany({
        where: {
          id: tokenRecord.id,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          replacedByToken: newRefreshToken,
        },
      });

      if (updateResult.count === 0) {
        throw new UnauthorizedException(ErrorMessages.AUTH.REFRESH_TOKEN_REUSED);
      }

      // Save the new refresh token
      await tx.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          deviceId,
          familyId,
          expiresAt: newExpiresAt,
        },
      });

      // Update device last activity
      await tx.userDevice.updateMany({
        where: {
          userId: user.id,
          deviceId,
        },
        data: {
          lastActiveAt: new Date(),
        },
      });
    });

    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const expiresIn = this.tokenService.getExpiresInSeconds(jwtExpiresIn);

    return {
      success: true,
      message: 'Refresh token successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      },
    };
  }
  async logout(logoutDto: LogoutDto, userId: string) {
    const { refreshToken } = logoutDto;

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: {
        token: refreshToken,
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        ErrorMessages.AUTH.INVALID_REFRESH_TOKEN,
      );
    }

    if (tokenRecord.userId !== userId) {
      throw new UnauthorizedException(
        ErrorMessages.AUTH.TOKEN_OWNERSHIP_FAILED,
      );
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        familyId: tokenRecord.familyId,
      },
      data: {
        isRevoked: true,
      },
    });

    return {
      success: true,
      message: 'Logout successfully',
      data: null,
    };
  }
}
