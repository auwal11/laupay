import { Module } from '@nestjs/common';
import { VtuService } from './vtu.service';
import { VTU_PROVIDER } from './providers/vtu-provider.interface';
import { MockVTUProvider } from './providers/mock-vtu.provider';
import { VtpassVtuProvider } from './providers/vtpass-vtu.provider';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Provider selection is driven by VTU_PROVIDER (requirement 2).
 *  - `vtpass`  → real VTpass SANDBOX, used for staging.
 *  - `mock`    → MockVTUProvider, reserved for automated/unit/E2E tests and
 *                local development only. NEVER selected by default in staging.
 */
const vtuProviderFactory = {
  provide: VTU_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    if (config.vtuProvider === 'vtpass') return new VtpassVtuProvider(config);
    return new MockVTUProvider();
  },
};

@Module({
  providers: [VtuService, vtuProviderFactory],
  exports: [VtuService],
})
export class VtuModule {}
