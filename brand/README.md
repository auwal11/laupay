# LAUPAY brand assets

The web and mobile implementations now use the existing LAUPAY visual language: midnight/deep navy, amber action accent, current dark glass dashboard surfaces, white/muted text and the LAUPAY flow mark. The web source remains the branding reference.

## Repository status

This `brand/` directory is still a source-package placeholder. The native mobile runtime assets currently used by Expo live in `apps/mobile/assets/images/` and are wired through the mobile Expo configuration. Do not assume that an empty folder here means the mobile app has no identity assets.

When an approved central brand package is available, it can be organized as:

```text
brand/
  logo/primary/      # main lockup for light backgrounds
  logo/dark/         # dark-background lockup
  logo/light/        # reversed mark/wordmark
  logo/monochrome/   # one-colour versions
  logo/symbol/       # mark without wordmark
  logo/app-icon/     # source app-icon assets
  icons/             # in-app iconography, not logo artwork
  guidelines/        # approved brand guidance
```

Changes to brand assets should preserve the web source-of-truth and update mobile/web references deliberately. Do not introduce unrelated external branding or replace the LAUPAY mark with emoji/system symbols.
