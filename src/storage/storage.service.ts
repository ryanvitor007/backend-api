import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private supabase: SupabaseClient;
  private readonly bucketName = 'tachograph-disks';

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_KEY ?? '',
    );
  }

  async uploadDiskImage(file: Express.Multer.File, pathPrefix: string): Promise<string> {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato de arquivo nao permitido. Apenas JPG, PNG e PDF sao aceitos.');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('O arquivo excede o limite maximo de 10MB.');
    }

    const fileExt = file.originalname?.split('.').pop() || 'jpg';
    const fileName = `${pathPrefix}-${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new BadRequestException(`Erro ao fazer upload da imagem: ${error.message}`);
    }

    return filePath;
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    if (!storagePath) return '';
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, 15 * 60);

    if (error || !data) {
      console.error('Error creating signed URL:', error);
      return '';
    }

    return data.signedUrl;
  }

  async deleteFile(storagePath: string): Promise<void> {
    if (!storagePath) return;
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([storagePath]);

    if (error) {
      console.error(`Erro ao remover arquivo orfao no Storage (${storagePath}):`, error);
    }
  }
}
