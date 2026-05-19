import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get databaseUrl(): string {
    const raw = this.require('DATABASE_URL');
    return this.normalizeDatabaseUrl(raw);
  }

  get jwtUserSecret(): string {
    return this.require('JWT_USER_SECRET');
  }

  get jwtDealerSecret(): string {
    return this.require('JWT_DEALER_SECRET');
  }

  get jwtPlatformSecret(): string {
    return this.require('JWT_PLATFORM_SECRET');
  }

  private require(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  private normalizeDatabaseUrl(input: string): string {
    const value = input.trim();

    try {
      // Already valid URL.
      new URL(value);
      return value;
    } catch {
      // Attempt recovery for unescaped credentials in postgres URL.
      const match = value.match(
        /^(postgres(?:ql)?:\/\/)([^:@\/?#]+):(.+)@([^\/?#]+)(.*)$/,
      );

      if (!match) {
        throw new Error('Invalid DATABASE_URL format');
      }

      const [, scheme, username, password, hostInfo, remainder] = match;
      const normalized = `${scheme}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostInfo}${remainder}`;

      try {
        new URL(normalized);
        return normalized;
      } catch {
        throw new Error('Invalid DATABASE_URL format');
      }
    }
  }
}
