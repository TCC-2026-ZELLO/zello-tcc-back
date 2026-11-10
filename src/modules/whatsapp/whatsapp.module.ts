import { Module, Global } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Global()
@Module({
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
