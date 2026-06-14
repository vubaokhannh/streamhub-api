import * as crypto from 'crypto';

export class TokenHelper {
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
