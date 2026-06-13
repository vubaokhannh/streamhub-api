import { extname } from 'path';

export const generateFileName = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
) => {
  const fileExtName = extname(file.originalname);
  const randomName = Math.round(Math.random() * 1e9);
  callback(null, `${Date.now()}-${randomName}${fileExtName}`);
};
