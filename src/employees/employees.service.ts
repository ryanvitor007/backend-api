/* eslint-disable */
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

  // Criar novo funcionário
  async create(createEmployeeDto: CreateEmployeeDto) {
    const { data, error } = await this.supabase
      .from('employees')
      .insert(createEmployeeDto)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // Atualizar funcionário
  async update(id: number, updateData: any) {
    const { data, error } = await this.supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
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

  // Validar Login
  async login(loginDto: LoginDto) {
    const { data: user, error } = await this.supabase
      .from('employees')
      .select('*')
      .eq('email', loginDto.email)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    if (user.password !== loginDto.password) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    // Retorna dados do usuário (sem a senha)
    const { password, ...result } = user;
    return result;
  }

  // Listar todos
  async findAll() {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return data;
  }
}
