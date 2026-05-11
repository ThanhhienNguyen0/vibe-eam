import { Controller, Get, Post, Body, UploadedFile, UseInterceptors, InternalServerErrorException, Inject, Delete, Param, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import * as fs from 'fs';

@Controller('api')
export class AppController {
  constructor(@Inject('APP_SERVICE') private readonly appService: AppService) {}

  @Get('inventory')
  getInventory() {
    if (!this.appService) {
      throw new InternalServerErrorException("AppService not injected correctly");
    }
    return this.appService.getInventory();
  }

  @Post('assets')
  async addAsset(@Body() asset: any) {
    return this.appService.addAsset(asset);
  }

  @Delete('assets/:id')
  async deleteAsset(@Param('id') id: string, @Query('force') force: string) {
    return this.appService.deleteAsset(id, force === 'true');
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    try {
      if (!this.appService) {
        throw new Error("AppService not injected correctly");
      }
      if (!file) {
        throw new Error("No file uploaded");
      }
      const count = this.appService.processFile(file.path, file.originalname);
      // Clean up
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return { message: "Successfully sync'd inventory", count };
    } catch (error: any) {
      console.error("Upload error:", error);
      throw new InternalServerErrorException("Failed to process file: " + error.message);
    }
  }
}
