# Brand Assets — Placeholder Structure

The final LAUPAY logo package (LAU FLOW BRIDGE direction — Deep Indigo /
Midnight Blue primary, Warm Amber accent) is still being finalized and has
**not** been created or invented here, per the project brief.

This folder only defines the structure the application references, so the
approved assets can be dropped in later without any application code
changes:

```
brand/
  logo/
    primary/       # main lockup, for light backgrounds
    dark/           # for dark backgrounds
    light/           # reversed/white version
    monochrome/       # single-color version
    symbol/            # the LAU/L-U flow-bridge mark alone, no wordmark
    app-icon/           # square icon assets (various sizes) for mobile/app-icon use
  icons/            # in-app iconography (not logo)
  guidelines/       # brand guideline documents, once available
```

Each subfolder is currently empty. When the approved package arrives, place
files using a consistent naming convention, e.g.:

```
brand/logo/primary/laupay-logo-primary.svg
brand/logo/primary/laupay-logo-primary@2x.png
brand/logo/app-icon/laupay-icon-512.png
```

Application code (Flutter `apps/mobile`, admin `apps/admin`) should
reference these paths via a single shared constants file (to be created in
`packages/shared` once the mobile/admin apps exist) rather than being
hard-coded in multiple places — so a future asset swap is a file-replacement
operation, not a code change.
