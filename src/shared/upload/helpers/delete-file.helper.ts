import * as fs from 'fs';
import * as path from 'path';

export const deleteFile = (filePath: string) => {
  if (!filePath) return;

  const fullPath = path.resolve(filePath);

  fs.stat(fullPath, (err, stats) => {
    if (err) {
      // File doesn't exist or we can't access it, just return
      return;
    }

    if (stats.isFile()) {
      fs.unlink(fullPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(`Failed to delete file ${fullPath}:`, unlinkErr);
        }
      });
    }
  });
};
