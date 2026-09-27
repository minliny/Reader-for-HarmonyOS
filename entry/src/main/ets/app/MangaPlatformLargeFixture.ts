// Fixed DEBUG-only non-interlaced PNG; independently generated Pillow ROI digests.
export interface MangaPlatformLargeRegion { id: string; position: number; regionY: number; width: number; height: number; sha256: string; }
export interface MangaPlatformLargeFixture { id: string; file: string; sha256: string; width: number; height: number; orientation: number; rois: MangaPlatformLargeRegion[]; }
export const MANGA_PLATFORM_LARGE_FIXTURE: MangaPlatformLargeFixture = {
  "id": "large-long",
  "file": "large-long-1024x32768.png",
  "sha256": "a300ee139c0c060f99a1da756167577c0239790c6149bfc984525d6cde181cb7",
  "width": 1024,
  "height": 32768,
  "orientation": 1,
  "rois": [
    {
      "id": "first",
      "position": 0,
      "regionY": 0,
      "width": 1024,
      "height": 1024,
      "sha256": "b6ac2ca3368d46908421d717b2f8129521152a26b92a442afcbcce83dad73b56"
    },
    {
      "id": "middle",
      "position": 0.5,
      "regionY": 16384,
      "width": 1024,
      "height": 1024,
      "sha256": "32c92c3d345a3f7efb94c553a5f9ba28f6e98aaaab9c01a7a57ef060a6988e23"
    },
    {
      "id": "last",
      "position": 1,
      "regionY": 31744,
      "width": 1024,
      "height": 1024,
      "sha256": "8a245cb8967746d7e4bf670633aa0e466d4eb6cf7b833f73d3bbee85eda84c6f"
    }
  ]
};
export const MANGA_PLATFORM_LARGE_CONTROL: MangaPlatformLargeFixture = {
  "id": "large-control",
  "file": "control-long-1024x2048.png",
  "sha256": "0586eda7f2e4a87861128904e4ed32765ec657b3ad6b016bb430f98cb4fce5a9",
  "width": 1024,
  "height": 2048,
  "orientation": 1,
  "rois": [
    {
      "id": "first",
      "position": 0,
      "regionY": 0,
      "width": 1024,
      "height": 1024,
      "sha256": "b6ac2ca3368d46908421d717b2f8129521152a26b92a442afcbcce83dad73b56"
    }
  ]
};
