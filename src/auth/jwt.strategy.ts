import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') ??
      'dev-only-fallback-change-in-production';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: { sub: number; role: string }) {
    // Segurança: apenas campos mínimos necessários para autorização no request.
    return { userId: payload.sub, role: payload.role };
  }
}
