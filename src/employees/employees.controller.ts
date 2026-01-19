import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, LoginDto } from './dto/create-employee.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.employeesService.login(loginDto);
  }

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  // NOVAS ROTAS
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.employeesService.update(+id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(+id);
  }
}
