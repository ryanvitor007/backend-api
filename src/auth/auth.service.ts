import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UAParser } from 'ua-parser-js';
import { LoginDto } from 'src/employees/dto/create-employee.dto';
import { EmployeesService } from 'src/employees/employees.service';
import { TransactionManager } from '../common/utils/transaction.manager';

@Injectable()
export class AuthService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(
    private readonly employeesService: EmployeesService,
    private readonly jwtService: JwtService,
    private readonly transactionManager: TransactionManager,
  ) {}

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async validateUser(loginDto: LoginDto) {
    const employee = await this.employeesService.findByEmail(loginDto.email);

    if (!employee) {
      throw new UnauthorizedException('Credenciais inv�lidas.');
    }

    if (employee.active === false) {
      throw new UnauthorizedException('Conta de usu�rio inativa.');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      employee.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inv�lidas.');
    }

    return employee;
  }

  async login(loginDto: LoginDto, ip: string, userAgent: string) {
    const employee = await this.validateUser(loginDto);

    const payload = {
      sub: employee.id,
      role: employee.role ?? 'Motorista',
    };

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '30d' });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();
    const device = `${uaResult.os.name || ''} ${uaResult.browser.name || ''}`.trim() || 'Desconhecido';

    await this.transactionManager.execute(async (client) => {
      await client.query(
        'DELETE FROM public.user_sessions WHERE user_id = $1 AND expires_at < now()',
        [employee.id],
      );

      await client.query(
        `INSERT INTO public.user_sessions (user_id, device, ip, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [employee.id, device, ip, refreshTokenHash, expiresAt.toISOString()],
      );
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: '15m',
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role ?? 'Motorista',
      },
    };
  }

  async refresh(refreshToken: string, ip: string, userAgent: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const userId = payload.sub;

      const { data: sessions, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString());

      if (error || !sessions || sessions.length === 0) {
        throw new UnauthorizedException('Sess�o expirada ou inv�lida.');
      }

      let activeSession: any = null;
      for (const session of sessions) {
        const match = await bcrypt.compare(refreshToken, session.refresh_token_hash);
        if (match) {
          activeSession = session;
          break;
        }
      }

      if (!activeSession) {
        throw new UnauthorizedException('Sess�o inv�lida.');
      }

      const employee = await this.employeesService.findById(userId);
      const role = employee?.role || payload.role || 'Motorista';

      const newPayload = { sub: userId, role };
      const newAccessToken = await this.jwtService.signAsync(newPayload, { expiresIn: '15m' });
      const newRefreshToken = await this.jwtService.signAsync(newPayload, { expiresIn: '30d' });

      const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 30);

      const parser = new UAParser(userAgent);
      const uaResult = parser.getResult();
      const device = `${uaResult.os.name || ''} ${uaResult.browser.name || ''}`.trim() || 'Desconhecido';

      await this.transactionManager.execute(async (client) => {
        await client.query('DELETE FROM public.user_sessions WHERE id = $1', [activeSession.id]);
        await client.query(
          `INSERT INTO public.user_sessions (user_id, device, ip, refresh_token_hash, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, device, ip, newRefreshTokenHash, newExpiresAt.toISOString()],
        );
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: '15m',
      };
    } catch (err) {
      throw new UnauthorizedException('Token de refresh inv�lido.');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const userId = payload.sub;

      const { data: sessions } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId);

      if (sessions) {
        for (const session of sessions) {
          const match = await bcrypt.compare(refreshToken, session.refresh_token_hash);
          if (match) {
            await this.supabase.from('user_sessions').delete().eq('id', session.id);
            break;
          }
        }
      }
      return { message: 'Logout efetuado com sucesso.' };
    } catch {
      throw new UnauthorizedException('Token inv�lido.');
    }
  }
}
