import { Module } from '@nestjs/common';
import { VtuService } from './vtu.service';
import { VTU_PROVIDER } from './providers/vtu-provider.interface';
import { MockVTUProvider } from './providers/mock-vtu.provider';

@Module({
  providers: [
    VtuService,
    { provide: VTU_PROVIDER, useClass: MockVTUProvider },
  ],
  exports: [VtuService],
})
export class VtuModule {}
