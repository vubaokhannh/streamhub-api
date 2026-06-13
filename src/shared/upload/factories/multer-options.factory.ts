import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { generateFileName } from '../helpers/filename.helper';
import { imageFileFilter } from '../helpers/file-filter.helper';
import { MAX_IMAGE_SIZE } from '../constants/upload.constants';

export const createMulterOptions = (destination: string): MulterOptions => {
  return {
    storage: diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(destination)) {
          fs.mkdirSync(destination, { recursive: true });
        }
        cb(null, destination);
      },
      filename: generateFileName,
    }),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: MAX_IMAGE_SIZE,
    },
  };
};
