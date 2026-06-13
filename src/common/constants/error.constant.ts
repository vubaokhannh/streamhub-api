export const ErrorMessages = {
  AUTH: {
    EMAIL_ALREADY_REGISTERED: 'Email already registered',
    INVALID_CREDENTIALS: 'Invalid credentials',
    USER_BLOCKED: 'User not found or is blocked',
    USER_NOT_FOUND: 'User not found',
    UNAUTHORIZED: 'Unauthorized',
    INVALID_REFRESH_TOKEN: 'Invalid refresh token',
    REFRESH_TOKEN_REVOKED: 'Refresh token has been revoked',
    REFRESH_TOKEN_EXPIRED: 'Refresh token has expired',
    TOKEN_OWNERSHIP_FAILED: 'Token ownership validation failed',
    REFRESH_TOKEN_REUSED: 'Refresh token has already been used',
  },
  COMMON: {
    SOMETHING_WENT_WRONG: 'Something went wrong, please try again later',
  },
} as const;
