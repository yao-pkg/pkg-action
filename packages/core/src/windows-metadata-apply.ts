// Windows PE metadata — resedit integration.
//
// Stage 2 (M3.2): parses the input binary with resedit's NtExecutable,
// layers VersionInfo / icons / RT_MANIFEST into the resource tree, then
// writes the patched executable. All file I/O flows through a DI shim
// so unit tests can hit the whole pipeline with in-memory buffers.
//
// Design notes:
//   - `applyWindowsMetadata` is called with a fully-resolved
//     WindowsMetadataInputs (see ./windows-metadata.ts). Parser errors
//     must surface as ValidationError BEFORE reaching this module.
//   - padVersionQuad is invoked here too — it validates uint16 ranges the
//     way resedit's setFileVersion silently clamps. Loud failure > quiet
//     truncation.
//   - Icons and manifests are each replaced at a well-known id (1 by
//     default for icons, 1 always for manifest). This matches what pkg's
//     own resedit integration emits, so re-running the sub-action is
//     idempotent.

import { readFile, writeFile } from 'node:fs/promises';
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { ResEditError } from './errors.ts';
import { padVersionQuad, type IconSpec, type WindowsMetadataInputs } from './windows-metadata.ts';

/** Windows resource type for application manifests (`RT_MANIFEST`). */
const RT_MANIFEST = 24;

export interface WindowsMetadataApplyDeps {
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly writeFile: (path: string, data: Uint8Array) => Promise<void>;
}

const defaultDeps: WindowsMetadataApplyDeps = {
  readFile: (p) => readFile(p),
  writeFile: async (p, d) => {
    await writeFile(p, d);
  },
};

/** Node's fs.readFile hands us a Buffer that may be a view over a larger
 *  pooled allocation. resedit expects a standalone ArrayBuffer, so copy
 *  just the bytes we need. */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

/**
 * Patch a Windows .exe with the given metadata.
 *
 * `inputPath` and `outputPath` may be the same — resedit reads the whole
 * binary into memory before touching the output, so in-place editing is
 * safe. The caller is responsible for Windows-only targets: calling this
 * on a non-PE file throws a ResEditError with the parse error chained.
 */
export async function applyWindowsMetadata(
  inputPath: string,
  outputPath: string,
  meta: WindowsMetadataInputs,
  deps: WindowsMetadataApplyDeps = defaultDeps,
): Promise<void> {
  // Fail fast on bad version strings. resedit's setFileVersion silently
  // clamps to uint16; we prefer a clear ValidationError here.
  if (meta.fileVersion !== undefined) padVersionQuad(meta.fileVersion);
  if (meta.productVersion !== undefined) padVersionQuad(meta.productVersion);

  let exe: NtExecutable;
  try {
    const raw = await deps.readFile(inputPath);
    exe = NtExecutable.from(toArrayBuffer(raw), { ignoreCert: true });
  } catch (err) {
    throw new ResEditError(`Failed to parse "${inputPath}" as a PE executable.`, { cause: err });
  }

  const res = NtExecutableResource.from(exe);

  writeVersionInfo(res, meta);
  await writeIcons(res, meta.icons, meta.lang, deps);
  await writeManifest(res, meta, deps);

  res.outputResource(exe);
  const out = exe.generate();
  try {
    await deps.writeFile(outputPath, new Uint8Array(out));
  } catch (err) {
    throw new ResEditError(`Failed to write patched binary "${outputPath}".`, { cause: err });
  }
}

function writeVersionInfo(res: NtExecutableResource, meta: WindowsMetadataInputs): void {
  const copyright =
    meta.legalCopyright ??
    (meta.companyName !== undefined
      ? `© ${String(new Date().getUTCFullYear())} ${meta.companyName}`
      : undefined);

  const strings: Record<string, string> = {};
  if (meta.productName !== undefined) strings['ProductName'] = meta.productName;
  if (meta.fileDescription !== undefined) strings['FileDescription'] = meta.fileDescription;
  if (meta.companyName !== undefined) strings['CompanyName'] = meta.companyName;
  if (copyright !== undefined) strings['LegalCopyright'] = copyright;
  if (meta.originalFilename !== undefined) strings['OriginalFilename'] = meta.originalFilename;
  if (meta.internalName !== undefined) strings['InternalName'] = meta.internalName;
  if (meta.comments !== undefined) strings['Comments'] = meta.comments;

  const hasAnything =
    Object.keys(strings).length > 0 ||
    meta.productVersion !== undefined ||
    meta.fileVersion !== undefined;
  if (!hasAnything) return;

  const vi = Resource.VersionInfo.createEmpty();
  vi.lang = meta.lang;
  if (Object.keys(strings).length > 0) {
    vi.setStringValues({ lang: meta.lang, codepage: meta.codepage }, strings);
  }
  if (meta.fileVersion !== undefined) vi.setFileVersion(meta.fileVersion, meta.lang);
  if (meta.productVersion !== undefined) vi.setProductVersion(meta.productVersion, meta.lang);
  vi.outputToResourceEntries(res.entries);
}

async function writeIcons(
  res: NtExecutableResource,
  icons: readonly IconSpec[],
  lang: number,
  deps: WindowsMetadataApplyDeps,
): Promise<void> {
  for (const spec of icons) {
    let raw: Uint8Array;
    try {
      raw = await deps.readFile(spec.path);
    } catch (err) {
      throw new ResEditError(`Failed to read icon "${spec.path}".`, { cause: err });
    }
    let iconFile: Data.IconFile;
    try {
      iconFile = Data.IconFile.from(toArrayBuffer(raw));
    } catch (err) {
      throw new ResEditError(`Icon "${spec.path}" is not a valid .ico file.`, { cause: err });
    }
    Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      spec.id,
      lang,
      iconFile.icons.map((item) => item.data),
    );
  }
}

async function writeManifest(
  res: NtExecutableResource,
  meta: WindowsMetadataInputs,
  deps: WindowsMetadataApplyDeps,
): Promise<void> {
  if (meta.manifestPath === undefined) return;
  let raw: Uint8Array;
  try {
    raw = await deps.readFile(meta.manifestPath);
  } catch (err) {
    throw new ResEditError(`Failed to read manifest "${meta.manifestPath}".`, { cause: err });
  }
  res.replaceResourceEntry({
    type: RT_MANIFEST,
    id: 1,
    lang: meta.lang,
    codepage: meta.codepage,
    bin: toArrayBuffer(raw),
  });
}
