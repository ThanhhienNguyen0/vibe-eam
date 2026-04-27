import { Controller, Get, Post, UploadedFile, UseInterceptors, InternalServerErrorException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import * as fs from 'fs';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('inventory')
  getInventory() {
    return this.appService.getInventory();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    try {
      if (!file) {
        throw new Error("No file uploaded");
      }
      const count = this.appService.processCsv(file.path);
      // Clean up
      fs.unlinkSync(file.path);
      return { message: "Successfully sync'd inventory", count };
    } catch (error: any) {
      console.error("Upload error:", error);
      throw new InternalServerErrorException("Failed to parse CSV: " + error.message);
    }
  }
}
