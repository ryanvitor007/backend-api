import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from 'src/employees/dto/create-employee.dto';
import { EmployeesService } from 'src/employees/employees.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto) {
    const employee = await this.employeesService.findByEmail(loginDto.email);

    if (!employee) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Segurança: comparação de hash com bcrypt; nunca usar === para senha.
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      employee.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return employee;
  }

  async login(loginDto: LoginDto) {
    const employee = await this.validateUser(loginDto);

    const payload = {
      sub: employee.id,
      role: employee.role ?? 'Motorista',
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      token_type: 'Bearer',
      expires_in: '15m',
      // Segurança/LGPD: JWT sem dados sensíveis como CPF ou e-mail.
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role ?? 'Motorista',
      },
    };
  }
}
