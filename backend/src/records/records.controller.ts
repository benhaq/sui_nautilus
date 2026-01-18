import {
  Body,
  Controller,
  Get,
  Header,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { MulterFile } from 'src/utils/types';
import { DownloadRecordFileDto, UploadRecordDto } from './dto/record.dto';
import { RecordsService } from './records.service';

@ApiTags('records')
@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload medical record files',
    description: 'Uploads encrypted medical files to Walrus and registers them on-chain',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Record uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadRecord(
    @Body() uploadRecordDto: UploadRecordDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB
        ],
        fileIsRequired: true,
      }),
    )
    files: MulterFile[],
  ) {
    return this.recordsService.uploadRecord(uploadRecordDto, files);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get record details',
    description: 'Retrieves medical record metadata from the blockchain',
  })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  async getRecord(@Param('id') id: string) {
    return this.recordsService.getRecord(id);
  }

  @Get('whitelist/:whitelistId')
  @ApiOperation({
    summary: 'Get all records in whitelist',
    description: 'Retrieves all medical records in a whitelist',
  })
  @ApiResponse({ status: 200, description: 'Records retrieved successfully' })
  async getRecordsByWhitelist(@Param('whitelistId') whitelistId: string) {
    return this.recordsService.getRecordsByWhitelist(whitelistId);
  }

  @Post(':id/download/prepare')
  @ApiOperation({
    summary: 'Prepare file download - Get message to sign',
    description:
      'Step 1: Get the message that needs to be signed by wallet. Returns sessionId and message.',
  })
  @ApiResponse({
    status: 200,
    description: 'Message prepared successfully',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        message: { type: 'array', items: { type: 'number' } },
        messageBase64: { type: 'string' },
        mimeType: { type: 'string' },
        extension: { type: 'string' },
        ttl: { type: 'number' },
      },
    },
  })
  async prepareDownload(
    @Param('id') recordId: string,
    @Body() body: { requesterAddress: string; fileIndex: number },
  ) {
    const result = await this.recordsService.prepareDownload(
      recordId,
      body.requesterAddress,
      body.fileIndex,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/download/complete')
  @ApiOperation({
    summary: 'Complete file download with signature',
    description: 'Step 2: Submit signature from wallet to download and decrypt file.',
  })
  @ApiResponse({
    status: 200,
    description: 'File downloaded and decrypted successfully',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  // @Header('Content-Type', 'application/octet-stream')
  async downloadWithSignature(
    @Param('id') recordId: string,
    @Body() body: { sessionId: string; signature: string },
    @Res() res: Response,
  ) {
    const result = await this.recordsService.downloadWithSignature(body.sessionId, body.signature);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', result.decryptedData.length);
    res.send(result.decryptedData);
  }

  @Post(':id/view')
  @ApiOperation({
    summary: 'View decrypted file content inline',
  })
  @ApiResponse({
    status: 200,
    description: 'File content for inline preview',
  })
  async viewRecordInline(
    @Body() body: { sessionId: string; signature: string },
    @Res() res: Response,
  ) {
    const { decryptedData, filename, mimeType } = await this.recordsService.viewRecordInline(
      body.sessionId,
      body.signature,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', decryptedData.length);

    return res.send(decryptedData);
  }

  @Post(':id/download')
  @ApiOperation({
    summary: 'Download and decrypt a record file',
    description: 'Downloads encrypted file from Walrus and decrypts it using Seal with SessionKey',
  })
  @ApiResponse({
    status: 200,
    description: 'File downloaded and decrypted successfully',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Record or file not found' })
  @Header('Content-Type', 'application/octet-stream')
  async downloadRecordFile(
    @Param('id') recordId: string,
    @Body() downloadDto: DownloadRecordFileDto,
    @Res() res: Response,
  ) {
    const result = await this.recordsService.downloadRecordFileWithSessionKey(
      recordId,
      downloadDto,
    );

    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(result.decryptedData);
  }
}
