import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Global() // Isso torna o módulo visível em toda a aplicação sem precisar importar em cada lugar
@Module({
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (configService: ConfigService) => {
        return createClient(
          configService.get<string>('SUPABASE_URL') ?? '',
          configService.get<string>('SUPABASE_KEY') ?? '',
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: ['SUPABASE_CLIENT'], // Exporta para que outros módulos possam usar
})
export class DatabaseModule {}
