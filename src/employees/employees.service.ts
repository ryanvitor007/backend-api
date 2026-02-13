/* eslint-disable */
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { CreateEmployeeDto, LoginDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeesService implements OnModuleInit {
  private supabase: any;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  private sanitizeEmployee<T extends { password?: string }>(employee: T): Omit<T, 'password'> {
    // Segurança/LGPD: evita vazamento de hash/senha para o front-end e logs de API.
    const { password, ...safeEmployee } = employee;
    return safeEmployee;
  }

  // Criar novo funcionário
  async create(createEmployeeDto: CreateEmployeeDto) {
    // Segurança: hash com bcrypt (salt rounds >= 10) antes da persistência.
    const passwordHash = await bcrypt.hash(createEmployeeDto.password, 10);

    const { data, error } = await this.supabase
      .from('employees')
      .insert({ ...createEmployeeDto, password: passwordHash })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.sanitizeEmployee(data);
  }

  // Atualizar funcionário
  async update(id: number, updateData: any) {
    let payload = { ...updateData };

    if (updateData?.password) {
      // Segurança: nunca permitir update de senha sem novo hash.
      payload.password = await bcrypt.hash(updateData.password, 10);
    }

    const { data, error } = await this.supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.sanitizeEmployee(data);
  }

  // Remover funcionário
  async remove(id: number) {
    const { error } = await this.supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Funcionário removido com sucesso' };
  }

  async findByEmail(email: string) {
    const { data: user, error } = await this.supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return null;
    }

    return user;
  }

  // Validar Login
  async login(loginDto: LoginDto) {
    const user = await this.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    // Segurança: comparação resistente com bcrypt.compare (sem igualdade direta de string).
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    return this.sanitizeEmployee(user);
  }

  // Listar todos
  async findAll() {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return (data ?? []).map((employee: any) => this.sanitizeEmployee(employee));
  }
}
