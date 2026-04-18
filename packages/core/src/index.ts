// @pkg-action/core — public barrel.
//
// M0 scaffold: intentionally empty. Real modules land in M1:
//   - inputs.ts          hand-rolled typed validator + metadata
//   - templates.ts       filename/artifact-name tokens
//   - targets.ts         triple parsing + matrix expansion + runner labels
//   - pkg-runner.ts      spawn pkg CLI
//   - pkg-output-map.ts  map on-disk pkg outputs back to target triples
//   - archive.ts         tar/7z shell-out + yazl zip writer
//   - checksum.ts        node:crypto digests + SHASUMS files
//   - windows-metadata.ts  resedit integration
//   - logger.ts / errors.ts / fs-utils.ts / summary.ts

export const VERSION = '0.0.0';
