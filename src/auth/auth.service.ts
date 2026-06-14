import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TokenType, AuthProvider, User } from '@prisma/client';
import { ErrorMessages } from '../common/constants/error.constant';
import { SuccessMessages } from '../common/constants/success.constant';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleTokenLoginDto } from './dto/google-token-login.dto';
import { TokenService } from './token.service';
import { TokenHelper } from './helpers/token.helper';
import { SendForgotPasswordEmailEvent, MAIL_CONSTANTS } from '../shared/mail';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private tokenService: TokenService,
    private eventEmitter: EventEmitter2,
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

    const tokens = await this.tokenService.generateTokensAndSave(
      user.id,
      user.email,
      user.role,
      activeDeviceId,
      activeDeviceName,
    );

    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as Partial<User>).password;
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

    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as Partial<User>).password;
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
      throw new UnauthorizedException(ErrorMessages.AUTH.REFRESH_TOKEN_REUSED);
    }

    if (tokenRecord.isRevoked) {
      throw new UnauthorizedException(ErrorMessages.AUTH.REFRESH_TOKEN_REVOKED);
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException(ErrorMessages.AUTH.REFRESH_TOKEN_EXPIRED);
    }

    const { user, deviceId, familyId } = tokenRecord;

    if (!user || user.deletedAt || user.status === 'BLOCKED') {
      throw new UnauthorizedException(ErrorMessages.AUTH.USER_BLOCKED);
    }

    const newAccessToken = this.tokenService.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );
    const newRefreshToken = this.tokenService.generateRefreshToken(
      user.id,
      deviceId,
    );

    const expiryString =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d';
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
        throw new UnauthorizedException(
          ErrorMessages.AUTH.REFRESH_TOKEN_REUSED,
        );
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

    const jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const expiresIn = this.tokenService.getExpiresInSeconds(jwtExpiresIn);

    return {
      success: true,
      message: SuccessMessages.AUTH.REFRESH_TOKEN,
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
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
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
      message: SuccessMessages.AUTH.LOGOUT,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.deletedAt) {
      await this.prisma.userToken.deleteMany({
        where: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
        },
      });

      const resetToken = TokenHelper.generateToken();
      const hashedToken = TokenHelper.hashToken(resetToken);

      const rawExpiresIn =
        this.configService.get<string>('RESET_PASSWORD_EXPIRES_IN') || '15m';
      const expiresInSeconds =
        this.tokenService.getExpiresInSeconds(rawExpiresIn);
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await this.prisma.userToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          type: TokenType.PASSWORD_RESET,
          expiresAt,
        },
      });

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      let displayExpiresIn = rawExpiresIn;
      if (rawExpiresIn.endsWith('m'))
        displayExpiresIn = rawExpiresIn.replace('m', ' minutes');
      else if (rawExpiresIn.endsWith('h'))
        displayExpiresIn = rawExpiresIn.replace('h', ' hours');
      else if (rawExpiresIn.endsWith('d'))
        displayExpiresIn = rawExpiresIn.replace('d', ' days');

      this.eventEmitter.emit(
        MAIL_CONSTANTS.EVENTS.FORGOT_PASSWORD,
        new SendForgotPasswordEmailEvent(
          user.email,
          user.fullName,
          resetLink,
          displayExpiresIn,
        ),
      );
    }

    return {
      success: true,
      message: SuccessMessages.AUTH.FORGOT_PASSWORD_SENT,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = TokenHelper.hashToken(dto.token);

    const userToken = await this.prisma.userToken.findFirst({
      where: {
        token: hashedToken,
        type: TokenType.PASSWORD_RESET,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!userToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const { user } = userToken;

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Mark token as used
      await tx.userToken.update({
        where: { id: userToken.id },
        data: { usedAt: new Date() },
      });

      // Delete other unused reset tokens
      await tx.userToken.deleteMany({
        where: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
        },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });

      // Delete all devices
      await tx.userDevice.deleteMany({
        where: { userId: user.id },
      });
    });

    return {
      success: true,
      message: SuccessMessages.AUTH.RESET_PASSWORD_SUCCESS,
    };
  }

  async validateGoogleUser(googleUser: {
    googleId: string;
    email: string;
    fullName: string;
    picture?: string;
  }) {
    const { googleId, email, fullName, picture } = googleUser;

    if (!email) {
      throw new BadRequestException('Email is required from Google profile');
    }

    // 1. Find existing provider link
    const userProvider = await this.prisma.userProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId: googleId,
        },
      },
      include: { user: true },
    });

    let user: User | null = null;

    if (userProvider) {
      user = userProvider.user;
    } else {
      // 2. If no provider link, check if user exists with the same email
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Create a new user
        user = await this.prisma.user.create({
          data: {
            email,
            fullName,
            avatarUrl: picture,
            emailVerifiedAt: new Date(),
          },
        });
      }

      // 3. Link Google AuthProvider to the user
      await this.prisma.userProvider.create({
        data: {
          userId: user.id,
          provider: AuthProvider.GOOGLE,
          providerUserId: googleId,
        },
      });
    }

    if (!user || user.status === 'BLOCKED' || user.deletedAt) {
      return null;
    }

    // Update last login timestamp
    user = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  }

  async loginWithGoogle(googleUser: {
    googleId: string;
    email: string;
    fullName: string;
    picture?: string;
  }) {
    const user = await this.validateGoogleUser(googleUser);
    if (!user) {
      throw new UnauthorizedException(ErrorMessages.AUTH.USER_BLOCKED);
    }

    const deviceId = crypto.randomUUID();
    const deviceName = 'Google OAuth Redirect';

    const tokens = await this.tokenService.generateTokensAndSave(
      user.id,
      user.email,
      user.role,
      deviceId,
      deviceName,
    );

    return tokens;
  }

  async verifyGoogleToken(idToken: string): Promise<{
    googleId: string;
    email: string;
    fullName: string;
    picture?: string;
  }> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
      );
      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google ID Token');
      }

      interface GoogleTokenInfo {
        sub: string;
        email: string;
        name?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
        aud: string;
        azp?: string;
      }

      const payload = (await response.json()) as GoogleTokenInfo;

      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      if (clientId && payload.aud !== clientId && payload.azp !== clientId) {
        throw new UnauthorizedException('Token client ID mismatch');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        fullName:
          payload.name ||
          `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
        picture: payload.picture,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to verify Google ID Token';
      throw new UnauthorizedException(message);
    }
  }

  async googleTokenLogin(dto: GoogleTokenLoginDto) {
    const { idToken, deviceId, deviceName } = dto;
    const googleProfile = await this.verifyGoogleToken(idToken);

    const user = await this.validateGoogleUser(googleProfile);
    if (!user) {
      throw new UnauthorizedException(ErrorMessages.AUTH.USER_BLOCKED);
    }

    const activeDeviceId = deviceId || crypto.randomUUID();
    const activeDeviceName = deviceName || 'Google Token Login';

    const tokens = await this.tokenService.generateTokensAndSave(
      user.id,
      user.email,
      user.role,
      activeDeviceId,
      activeDeviceName,
    );

    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as Partial<User>).password;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }
}
