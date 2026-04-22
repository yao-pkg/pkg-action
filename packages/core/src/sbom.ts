// SBOM generator — zero new runtime deps.
//
// Walks the project's node_modules tree (production deps only) and renders
// either CycloneDX 1.5 or SPDX 2.3 JSON. No external SBOM library — cap-6
// runtime-dep budget is already spent.
//
// Pure functions + a tiny DI-able fs shim so unit tests run on a synthetic
// node_modules layout without touching the real workspace.

import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { atomicWriteFile } from './fs-utils.ts';
import { ValidationError } from './errors.ts';

// ─── Public types ─────────────────────────────────────────────────────────

export type SbomFormat = 'none' | 'cyclonedx' | 'spdx';

export const SBOM_FORMATS: readonly SbomFormat[] = ['none', 'cyclonedx', 'spdx'];

export function isSbomFormat(v: string): v is SbomFormat {
  return SBOM_FORMATS.includes(v as SbomFormat);
}

export interface DepNode {
  readonly name: string;
  readonly version: string;
  /** PackageURL canonical form: pkg:npm/<scope>%2F<name>@<version> */
  readonly purl: string;
  readonly license: string | undefined;
  readonly description: string | undefined;
}

export interface SbomArtifactRef {
  readonly filename: string;
  /** Hex-encoded. algo is CycloneDX naming (SHA-256). */
  readonly hashes: ReadonlyArray<{ algo: 'SHA-256' | 'SHA-512' | 'MD5'; value: string }>;
}

export interface SbomData {
  readonly project: { name: string; version: string };
  readonly deps: readonly DepNode[];
  readonly artifacts: readonly SbomArtifactRef[];
  readonly actionVersion: string;
  /** ISO-8601 UTC. Injected so tests get deterministic output. */
  readonly timestamp: string;
  /** UUID v4. Injected so tests get deterministic output. */
  readonly serialNumber: string;
}

// ─── Dependency walker ────────────────────────────────────────────────────

/** Minimal fs shim — the two calls we make. */
export interface SbomFsShim {
  readFile(path: string, encoding: 'utf8'): Promise<string>;
}

const defaultFs: SbomFsShim = {
  readFile: (p, enc) => readFile(p, enc),
};

interface PackageJsonShape {
  readonly name?: string;
  readonly version?: string;
  readonly license?: string | { type?: string };
  readonly description?: string;
  readonly dependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
}

async function readPackageJson(
  path: string,
  fs: SbomFsShim,
): Promise<PackageJsonShape | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(raw) as PackageJsonShape;
  } catch {
    return undefined;
  }
}

/**
 * Walk the production dependency tree rooted at `projectDir`. Dev-dependencies
 * are excluded — they are compile-time only and do not end up in the binary.
 *
 * Resolution mirrors Node's CommonJS lookup: for each dep, we check
 * `<projectDir>/node_modules/<name>/package.json` first, then fall back to
 * ancestor `node_modules` directories. This handles hoisted monorepo layouts
 * (yarn workspaces, npm7+).
 */
export async function collectDependencyTree(
  projectDir: string,
  fs: SbomFsShim = defaultFs,
): Promise<DepNode[]> {
  const rootPkg = await readPackageJson(join(projectDir, 'package.json'), fs);
  if (rootPkg === undefined) {
    throw new ValidationError(`SBOM: cannot read package.json at ${projectDir}`);
  }

  const seen = new Map<string, DepNode>();

  async function visit(name: string, fromDir: string): Promise<void> {
    const resolved = await resolveNodeModule(name, fromDir, fs);
    if (resolved === undefined) return;
    const key = `${resolved.pkg.name ?? name}@${resolved.pkg.version ?? '0.0.0'}`;
    if (seen.has(key)) return;
    const node: DepNode = {
      name: resolved.pkg.name ?? name,
      version: resolved.pkg.version ?? '0.0.0',
      purl: toPurl(resolved.pkg.name ?? name, resolved.pkg.version ?? '0.0.0'),
      license: normalizeLicense(resolved.pkg.license),
      description: resolved.pkg.description,
    };
    seen.set(key, node);
    const children = {
      ...(resolved.pkg.dependencies ?? {}),
      ...(resolved.pkg.optionalDependencies ?? {}),
    };
    for (const childName of Object.keys(children)) {
      await visit(childName, resolved.dir);
    }
  }

  const directDeps = Object.keys(rootPkg.dependencies ?? {});
  for (const dep of directDeps) {
    await visit(dep, projectDir);
  }

  return [...seen.values()].sort((a, b) =>
    a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
  );
}

interface ResolvedModule {
  readonly dir: string;
  readonly pkg: PackageJsonShape;
}

async function resolveNodeModule(
  name: string,
  fromDir: string,
  fs: SbomFsShim,
): Promise<ResolvedModule | undefined> {
  let current = fromDir;
  // Walk up until we hit the filesystem root.
  for (;;) {
    const candidate = join(current, 'node_modules', name);
    const pkg = await readPackageJson(join(candidate, 'package.json'), fs);
    if (pkg !== undefined) return { dir: candidate, pkg };
    const parent = join(current, '..');
    if (parent === current) return undefined;
    current = parent;
  }
}

function normalizeLicense(raw: PackageJsonShape['license']): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && typeof raw.type === 'string') return raw.type;
  return undefined;
}

function toPurl(name: string, version: string): string {
  // pkg:npm/@scope%2Fname@version per PackageURL spec.
  if (name.startsWith('@')) {
    const [scope, bare] = name.split('/', 2);
    return `pkg:npm/${encodeURIComponent(scope ?? '')}%2F${encodeURIComponent(bare ?? '')}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

// ─── Renderers ────────────────────────────────────────────────────────────

export function renderCycloneDx(data: SbomData): string {
  const doc = {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${data.serialNumber}`,
    version: 1,
    metadata: {
      timestamp: data.timestamp,
      tools: [
        {
          vendor: 'yao-pkg',
          name: 'pkg-action',
          version: data.actionVersion,
        },
      ],
      component: {
        type: 'application',
        'bom-ref': `${data.project.name}@${data.project.version}`,
        name: data.project.name,
        version: data.project.version,
        purl: toPurl(data.project.name, data.project.version),
      },
    },
    components: data.deps.map((d) => {
      const comp: Record<string, unknown> = {
        type: 'library',
        'bom-ref': d.purl,
        name: d.name,
        version: d.version,
        purl: d.purl,
      };
      if (d.license !== undefined) {
        comp['licenses'] = [{ license: { id: d.license } }];
      }
      if (d.description !== undefined) comp['description'] = d.description;
      return comp;
    }),
    ...(data.artifacts.length > 0
      ? {
          formulation: [
            {
              components: data.artifacts.map((a) => ({
                type: 'file',
                name: a.filename,
                hashes: a.hashes.map((h) => ({ alg: h.algo, content: h.value })),
              })),
            },
          ],
        }
      : {}),
  };
  return JSON.stringify(doc, null, 2);
}

export function renderSpdx(data: SbomData): string {
  const rootRef = `SPDXRef-Package-${sanitizeSpdxId(data.project.name)}`;
  const packages: Array<Record<string, unknown>> = [
    {
      SPDXID: rootRef,
      name: data.project.name,
      versionInfo: data.project.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      externalRefs: [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: toPurl(data.project.name, data.project.version),
        },
      ],
    },
  ];
  const relationships: Array<Record<string, unknown>> = [
    {
      spdxElementId: 'SPDXRef-DOCUMENT',
      relationshipType: 'DESCRIBES',
      relatedSpdxElement: rootRef,
    },
  ];
  for (const dep of data.deps) {
    const depRef = `SPDXRef-Package-npm-${sanitizeSpdxId(dep.name)}-${sanitizeSpdxId(dep.version)}`;
    const pkg: Record<string, unknown> = {
      SPDXID: depRef,
      name: dep.name,
      versionInfo: dep.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      externalRefs: [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: dep.purl,
        },
      ],
    };
    if (dep.license !== undefined) pkg['licenseConcluded'] = dep.license;
    if (dep.description !== undefined) pkg['description'] = dep.description;
    packages.push(pkg);
    relationships.push({
      spdxElementId: rootRef,
      relationshipType: 'DEPENDS_ON',
      relatedSpdxElement: depRef,
    });
  }
  for (const artifact of data.artifacts) {
    const fileRef = `SPDXRef-File-${sanitizeSpdxId(artifact.filename)}`;
    const checksums = artifact.hashes.map((h) => ({
      algorithm: h.algo.replace('-', ''),
      checksumValue: h.value,
    }));
    packages.push({
      SPDXID: fileRef,
      name: artifact.filename,
      versionInfo: data.project.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      checksums,
    });
    relationships.push({
      spdxElementId: rootRef,
      relationshipType: 'GENERATES',
      relatedSpdxElement: fileRef,
    });
  }
  const doc = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${data.project.name}-${data.project.version}`,
    documentNamespace: `https://yao-pkg.github.io/pkg-action/spdxdocs/${encodeURIComponent(data.project.name)}-${encodeURIComponent(data.project.version)}-${data.serialNumber}`,
    creationInfo: {
      created: data.timestamp,
      creators: [`Tool: yao-pkg/pkg-action@${data.actionVersion}`],
    },
    packages,
    relationships,
  };
  return JSON.stringify(doc, null, 2);
}

function sanitizeSpdxId(raw: string): string {
  // SPDX IDs must match [A-Za-z0-9.-]+ (no slashes, no scope chars).
  return raw.replace(/[^A-Za-z0-9.-]/g, '-');
}

// ─── Orchestrator-facing writer ───────────────────────────────────────────

export interface WriteSbomRequest {
  readonly format: Exclude<SbomFormat, 'none'>;
  readonly outDir: string;
  readonly data: SbomData;
}

/** Write the SBOM file. Returns its absolute path. */
export async function writeSbom(req: WriteSbomRequest): Promise<string> {
  const suffix = req.format === 'cyclonedx' ? 'cdx.json' : 'spdx.json';
  const base = `${req.data.project.name}-${req.data.project.version}.${suffix}`;
  const outPath = join(req.outDir, base);
  const body = req.format === 'cyclonedx' ? renderCycloneDx(req.data) : renderSpdx(req.data);
  await atomicWriteFile(outPath, body);
  return outPath;
}

// ─── Helpers used by the orchestrator to assemble SbomData ────────────────

export function newSbomSerialNumber(): string {
  return randomUUID();
}

export function nowTimestamp(): string {
  return new Date().toISOString();
}
