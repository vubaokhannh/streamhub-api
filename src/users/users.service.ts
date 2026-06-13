import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { deleteFile } from '../shared/upload';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.email && { email: dto.email }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    };
  }

  async updateAvatar(userId: string, avatar: Express.Multer.File) {
    if (!avatar) {
      throw new BadRequestException('Avatar is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (user.avatarUrl) {
      deleteFile(user.avatarUrl);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: avatar.path,
      },
      select: {
        id: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      message: 'Avatar updated successfully',
      data: updatedUser,
    };
  }
}
