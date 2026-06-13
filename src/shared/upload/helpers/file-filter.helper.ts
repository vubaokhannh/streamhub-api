import { BadRequestException } from '@nestjs/common';

export const imageFileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
    return callback(
      new BadRequestException('Only jpg, jpeg, png and webp files are allowed'),
      false,
    );
  }
  callback(null, true);
};
