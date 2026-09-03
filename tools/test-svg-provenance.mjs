import { syncSvgAssets } from './sync-svg-assets.mjs';

const result = await syncSvgAssets({ check: true });
console.log(`svg provenance: ${result.count} assets verified`);
