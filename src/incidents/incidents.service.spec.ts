/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsService } from './incidents.service';

// Mock do Supabase
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
  then: jest
    .fn()
    .mockImplementation((callback) => callback({ data: [], error: null })),
};

describe('IncidentsService', () => {
  let service: IncidentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IncidentsService],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);

    // Injeção forçada do Mock
    (service as any).supabase = mockSupabaseClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an incident', async () => {
    const dto = {
      type: 'Colisão',
      date: '2024-03-10',
      time: '14:30',
      vehiclePlate: 'ABC-1234',
      vehicleModel: 'Volvo FH 540', // <--- CORREÇÃO: Adicionado o campo obrigatório
      driverName: 'João',
      location: 'SP',
      description: 'Teste',
      estimatedCost: 100,
      insuranceClaim: false,
    };

    const result = await service.create(dto);
    expect(result).toBeDefined();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('incidents');
  });

  it('should find all incidents', async () => {
    mockSupabaseClient.select.mockResolvedValueOnce({
      data: [{ id: 1, tipo: 'Colisão' }],
      error: null,
    });

    const result = await service.findAll();
    expect(Array.isArray(result)).toBe(true);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('incidents');
  });
});
