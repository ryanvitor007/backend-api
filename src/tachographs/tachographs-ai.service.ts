import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { StorageService } from '../storage/storage.service';

/**
 * Interface para a resposta estruturada exigida pelo modelo Maker-Checker
 */
export interface TachographAiAnalysisResult {
  status: 'COMPLIANT' | 'ALERT';
  infractions: string[];
  analysis_summary: string;
}

@Injectable()
export class TachographsAiService implements OnModuleInit {
  private readonly logger = new Logger(TachographsAiService.name);
  private supabase: SupabaseClient;
  private anthropic: Anthropic;

  constructor(
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY não configurada. A auditoria automática de tacógrafos via IA estará desativada até que a chave seja informada.',
      );
    } else {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Serviço de IA Anthropic Claude 3.5 Sonnet inicializado com sucesso.');
    }
  }

  /**
   * Cron Job executado a cada minuto.
   * Busca até 5 registros de tacógrafos com status 'PENDING_ANALYSIS'
   * e processa a auditoria automática via Claude 3.5 Sonnet.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingTachographsAudit() {
    if (!this.anthropic) {
      return;
    }

    try {
      // 1. Busca até 5 registros pendentes de análise no Supabase
      const { data: pendingRecords, error } = await this.supabase
        .from('tachograph_records')
        .select('*, driver:employees(name), vehicle:vehicles(placa, modelo)')
        .eq('status', 'PENDING_ANALYSIS')
        .is('deleted_at', null)
        .limit(5);

      if (error) {
        this.logger.error(`Erro ao buscar tacógrafos pendentes: ${error.message}`);
        return;
      }

      if (!pendingRecords || pendingRecords.length === 0) {
        return;
      }

      this.logger.log(`Iniciando auditoria IA para ${pendingRecords.length} tacógrafos pendentes...`);

      for (const record of pendingRecords) {
        await this.auditTachographRecord(record);
      }
    } catch (err: any) {
      this.logger.error(`Erro inesperado no cron job de auditoria de tacógrafos: ${err.message || err}`);
    }
  }

  /**
   * Processa a auditoria de um registro individual de tacógrafo.
   */
  private async auditTachographRecord(record: any) {
    try {
      if (!record.disk_image_path) {
        this.logger.warn(`Registro ID ${record.id} não possui caminho de imagem (disk_image_path). Ignorando.`);
        return;
      }

      // 1. Download do arquivo do Supabase Storage
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from('tachograph-disks')
        .download(record.disk_image_path);

      if (downloadError || !fileData) {
        this.logger.error(
          `Falha ao baixar imagem do disco para o registro ID ${record.id}: ${downloadError?.message || 'Arquivo indisponível'}`,
        );
        return;
      }

      // 2. Converte a imagem para Buffer e Base64
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');
      const mediaType = this.getMediaTypeFromPath(record.disk_image_path);

      // 3. Monta o Prompt de Engenharia (Maker-Checker)
      const systemPrompt = `Você é um Auditor de Frotas Sênior especialista em análise visual e regulatória de discos de tacógrafo analógico (Resolução CONTRAN e Legislação de Trânsito Brasileira).
Seu papel é atuar como o validador 'Checker' no modelo Maker-Checker.

Regras de Auditoria:
1. Avalie a imagem do disco polar identificando a linha tracejada de velocidade (verifique picos contínuos acima de 80 km/h).
2. Valida o tempo de condução e períodos de descanso/parada do veículo na linha de tempo/jornada.
3. Compare o comportamento traçado no disco com os dados declarados pelo motorista.

Instrução Importante de Formato:
Sua resposta DEVE SER EXCLUSIVAMENTE um objeto JSON válido, sem texto explicativo adicional, sem marcações Markdown de código (não inclua \`\`\`json ou qualquer outra formatação).

Estrutura JSON Obrigatória:
{
  "status": "COMPLIANT" | "ALERT",
  "infractions": ["Descrição detalhada de cada infração encontrada, se houver"],
  "analysis_summary": "Resumo técnico objetivo da auditoria da imagem e dos dados"
}`;

      const driverName = record.driver?.name || 'Não identificado';
      const vehiclePlaca = record.vehicle?.placa || 'Não identificada';

      const userContent = `Analise o disco de tacógrafo em anexo e valide os seguintes metadados declarados:
- Motorista: ${driverName}
- Veículo (Placa): ${vehiclePlaca}
- Data da Leitura: ${record.reading_date}
- Horário Inicial: ${record.start_at || 'Não informado'}
- Horário Final: ${record.end_at || 'Não informado'}
- Total de Horas Declaradas: ${record.total_hours ?? 'N/A'}
- KM Inicial: ${record.km_start ?? 'N/A'}
- KM Final: ${record.km_end ?? 'N/A'}
- Observações do Motorista: ${record.observations || 'Nenhuma'}

Responda rigorosamente com o JSON contendo status, infractions e analysis_summary.`;

      // 4. Chamada para a API Anthropic Claude 3.5 Sonnet
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: userContent,
              },
            ],
          },
        ],
      });

      // 5. Parse da Resposta da IA
      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText = textBlock ? textBlock.text : '';

      const parsedAnalysis = this.parseAiResponse(responseText);

      // 6. Atualização do registro no Supabase
      const newStatus = parsedAnalysis.status === 'COMPLIANT' ? 'COMPLIANT' : 'ALERT';
      
      const auditLogHeader = `[Auditoria IA - ${newStatus}]: ${parsedAnalysis.analysis_summary}`;
      const infractionsText = parsedAnalysis.infractions.length > 0
        ? `\nInfrações Detectadas: ${parsedAnalysis.infractions.join('; ')}`
        : '';
      
      const updatedObservations = record.observations
        ? `${record.observations}\n\n${auditLogHeader}${infractionsText}`
        : `${auditLogHeader}${infractionsText}`;

      const { error: updateError } = await this.supabase
        .from('tachograph_records')
        .update({
          status: newStatus,
          observations: updatedObservations,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (updateError) {
        this.logger.error(`Erro ao atualizar o registro de tacógrafo ID ${record.id}: ${updateError.message}`);
        return;
      }

      this.logger.log(
        `Auditoria concluída com sucesso para o tacógrafo ID ${record.id}. Status: ${newStatus}`,
      );

      // 7. Emitir evento para invalidação do cache do Dashboard
      this.eventEmitter.emit('dashboard.invalidate_cache');
    } catch (err: any) {
      this.logger.error(
        `Erro ao processar auditoria via IA para o registro ID ${record.id}: ${err.message || err}`,
      );
    }
  }

  /**
   * Converte a extensão do arquivo para o media_type aceito pela API da Anthropic.
   */
  private getMediaTypeFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'jpeg':
      case 'jpg':
      default:
        return 'image/jpeg';
    }
  }

  /**
   * Realiza o parse da resposta JSON enviada pelo Claude, removendo blocos de código se presentes.
   */
  private parseAiResponse(responseText: string): TachographAiAnalysisResult {
    try {
      // Remove possíveis marcadores de código Markdown caso o modelo os tenha inserido
      const cleaned = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        status: parsed.status === 'COMPLIANT' ? 'COMPLIANT' : 'ALERT',
        infractions: Array.isArray(parsed.infractions) ? parsed.infractions : [],
        analysis_summary: parsed.analysis_summary || 'Análise realizada pela IA.',
      };
    } catch (error) {
      this.logger.error(`Falha ao realizar parse do JSON retornado pelo Claude: ${responseText}`);
      return {
        status: 'ALERT',
        infractions: ['Erro ao interpretar retorno estruturado da auditoria automática.'],
        analysis_summary: 'Inconsistência na resposta da IA durante a auditoria automática.',
      };
    }
  }
}
