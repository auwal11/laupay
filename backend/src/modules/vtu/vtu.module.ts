import { Module } from '@nestjs/common';
import { VtuService } from './vtu.service';
import { VTU_PROVIDER } from './providers/vtu-provider.interface';
import { MockVTUProvider } from './providers/mock-vtu.provider';
import { VtpassVtuProvider } from './providers/vtpass-vtu.provider';
import { VtuAgentVtuProvider } from './providers/vtuagent-vtu.provider';
import { CheapDataHubVtuProvider } from './providers/cheapdatahub-vtu.provider';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Provider selection is driven by VTU_PROVIDER (requirement 2).
 *  - `vtuagent`     → VTUAgent's real API.
 *  - `cheapdatahub` → CheapDataHub's real reseller API.
 *  - `mock`         → test double only; production boot rejects it.
 */
const vtuProviderFactory = {
  provide: VTU_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    if (config.vtuProvider === 'vtuagent') return new VtuAgentVtuProvider(config);
    if (config.vtuProvider === 'cheapdatahub') return new CheapDataHubVtuProvider(config);
    if (config.vtuProvider === 'vtpass') return new VtpassVtuProvider(config);
    if (config.nodeEnv === 'test' || !config.isProduction) return new MockVTUProvider();
    throw new Error(`[config] No real VTU provider configured: ${config.vtuProvider}`);
  },
};

@Module({
  providers: [VtuService, vtuProviderFactory],
  exports: [VtuService, VTU_PROVIDER],
})
export class VtuModule {}
