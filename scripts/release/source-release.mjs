import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { walkFiles } from "../quality/core/filesystem.mjs";
import { repositoryRoot, resolveFromRepository } from "../quality/core/repo-context.mjs";

export const releasePolicyPath = resolveFromRepository("scripts/release/release-policy.json");
export const releasePolicy = JSON.parse(fs.readFileSync(releasePolicyPath, "utf8"));
export const releaseOutputDirectory = resolveFromRepository(releasePolicy.outputDirectory);
export const releaseArchivePath = path.join(releaseOutputDirectory, releasePolicy.archiveName);
export const releaseChecksumPath = `${releaseArchivePath}.sha256`;
export const releaseSbomPath = path.join(releaseOutputDirectory, "unicorecrm-web.cdx.json");
export const releaseManifestPath = path.join(releaseOutputDirectory, "release-manifest.json");

const UTF8_FLAG = 0x0800;
const DEFLATE_METHOD = 8;
const DOS_TIME = 0;
const DOS_DATE = 0x21;
const CRC_TABLE = createCrcTable();

export function normalizePath(value) {
  return value.split(path.sep).join("/");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function collectReleaseFiles(root = repositoryRoot, policy = releasePolicy) {
  const excludedDirectories = new Set(policy.excludedDirectories);
  const excludedFiles = new Set(policy.excludedFiles);
  const excludedSuffixes = policy.excludedSuffixes ?? [];
  const allowedEnvironmentFiles = new Set(policy.allowedEnvironmentFiles ?? []);
  const environmentPatterns = (policy.excludedEnvironmentPatterns ?? []).map((source) => new RegExp(source, "u"));
  return walkFiles(root, {
    excludeDirectory: (entryName) => excludedDirectories.has(entryName),
  })
    .map((absolutePath) => ({ absolutePath, relativePath: normalizePath(path.relative(root, absolutePath)) }))
    .filter(({ relativePath }) => {
      const name = path.posix.basename(relativePath);
      if (excludedFiles.has(name)) return false;
      if (excludedSuffixes.some((suffix) => name.endsWith(suffix))) return false;
      if (!allowedEnvironmentFiles.has(name) && environmentPatterns.some((pattern) => pattern.test(name))) return false;
      return true;
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function createSourceArchive(outputPath = releaseArchivePath, options = {}) {
  const root = options.root ?? repositoryRoot;
  const policy = options.policy ?? releasePolicy;
  const files = collectReleaseFiles(root, policy);
  const rootDirectory = policy.rootDirectory;
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = fs.readFileSync(file.absolutePath);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const archiveName = `${rootDirectory}/${file.relativePath}`;
    const name = Buffer.from(archiveName, "utf8");
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(DEFLATE_METHOD, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(DEFLATE_METHOD, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([...localParts, centralDirectory, end]));
  return { outputPath, files };
}

export function inspectSourceArchive(archivePath = releaseArchivePath) {
  const archive = fs.readFileSync(archivePath);
  const endOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Invalid central-directory signature at entry ${index}.`);
    const method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local-header signature for ${name}.`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressed : method === DEFLATE_METHOD ? zlib.inflateRawSync(compressed) : null;
    if (!data) throw new Error(`Unsupported compression method ${method} for ${name}.`);
    if (data.length !== uncompressedSize) throw new Error(`Size mismatch for ${name}.`);
    if (crc32(data) !== expectedCrc) throw new Error(`CRC mismatch for ${name}.`);
    entries.push({ name, data, sha256: sha256(data), size: data.length });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { archiveSha256: sha256(archive), entries };
}

export function createCycloneDxSbom(lockPath = resolveFromRepository("package-lock.json")) {
  const lockBytes = fs.readFileSync(lockPath);
  const lock = JSON.parse(lockBytes.toString("utf8"));
  const rootPackage = lock.packages?.[""] ?? {};
  const componentMap = new Map();
  for (const [packagePath, descriptor] of Object.entries(lock.packages ?? {})) {
    if (!packagePath || !descriptor?.version) continue;
    const name = packageNameFromLockPath(packagePath);
    const version = descriptor.version;
    const bomRef = `pkg:npm/${encodePackageName(name)}@${encodeURIComponent(version)}`;
    if (componentMap.has(bomRef)) continue;
    componentMap.set(bomRef, {
      type: "library",
      "bom-ref": bomRef,
      name,
      version,
      scope: descriptor.dev ? "optional" : "required",
      purl: bomRef,
      hashes: descriptor.integrity ? [integrityHash(descriptor.integrity)] : undefined,
    });
  }
  const components = [...componentMap.values()]
    .sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]))
    .map((component) => Object.fromEntries(Object.entries(component).filter(([, value]) => value !== undefined)));
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${uuidFromHash(sha256(lockBytes))}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        "bom-ref": `pkg:npm/${rootPackage.name}@${rootPackage.version}`,
        name: rootPackage.name,
        version: rootPackage.version,
      },
      properties: [
        { name: "unicorecrm:source", value: "package-lock.json" },
        { name: "unicorecrm:package-lock-sha256", value: sha256(lockBytes) }
      ]
    },
    components,
  };
}

export function writeReleaseEvidence(options = {}) {
  const outputDirectory = options.outputDirectory ?? releaseOutputDirectory;
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const archivePath = path.join(outputDirectory, releasePolicy.archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const sbomPath = path.join(outputDirectory, path.basename(releaseSbomPath));
  const manifestPath = path.join(outputDirectory, path.basename(releaseManifestPath));
  const archiveResult = createSourceArchive(archivePath);
  const archiveBytes = fs.readFileSync(archivePath);
  const archiveSha256 = sha256(archiveBytes);
  const sbom = createCycloneDxSbom();
  const sbomText = `${JSON.stringify(sbom, null, 2)}\n`;
  fs.writeFileSync(sbomPath, sbomText);
  fs.writeFileSync(checksumPath, `${archiveSha256}  ${releasePolicy.archiveName}\n`);
  const manifest = {
    schemaVersion: 1,
    package: JSON.parse(fs.readFileSync(resolveFromRepository("package.json"), "utf8")).version,
    archiveName: releasePolicy.archiveName,
    rootDirectory: releasePolicy.rootDirectory,
    sourceFileCount: archiveResult.files.length,
    archiveSha256,
    sbom: {
      file: path.basename(sbomPath),
      sha256: sha256(Buffer.from(sbomText)),
      format: "CycloneDX",
      specVersion: "1.5",
      componentCount: sbom.components.length,
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { archivePath, checksumPath, sbomPath, manifestPath, manifest };
}

export function verifyReleaseEvidence(options = {}) {
  const outputDirectory = options.outputDirectory ?? releaseOutputDirectory;
  const archivePath = path.join(outputDirectory, releasePolicy.archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const sbomPath = path.join(outputDirectory, path.basename(releaseSbomPath));
  const manifestPath = path.join(outputDirectory, path.basename(releaseManifestPath));
  for (const required of [archivePath, checksumPath, sbomPath, manifestPath]) {
    if (!fs.existsSync(required)) throw new Error(`Missing release artifact: ${required}`);
  }
  const inspection = inspectSourceArchive(archivePath);
  const sourceFiles = collectReleaseFiles();
  const expected = new Map(sourceFiles.map((file) => [
    `${releasePolicy.rootDirectory}/${file.relativePath}`,
    sha256(fs.readFileSync(file.absolutePath)),
  ]));
  const actual = new Map(inspection.entries.map((entry) => [entry.name, entry.sha256]));
  if (actual.size !== inspection.entries.length) throw new Error("Archive contains duplicate entry names.");
  if (inspection.entries.length !== sourceFiles.length) throw new Error(`Archive entry count drifted: expected ${sourceFiles.length}, received ${inspection.entries.length}.`);
  const topRoots = new Set(inspection.entries.map((entry) => entry.name.split("/")[0]));
  if (topRoots.size !== 1 || !topRoots.has(releasePolicy.rootDirectory)) throw new Error(`Archive must contain exactly root ${releasePolicy.rootDirectory}/.`);
  const forbidden = inspection.entries.filter((entry) => isForbiddenArchiveEntry(entry.name));
  if (forbidden.length) throw new Error(`Forbidden archive entries:\n${forbidden.map((entry) => entry.name).join("\n")}`);
  const missing = [...expected.keys()].filter((name) => !actual.has(name));
  const extra = [...actual.keys()].filter((name) => !expected.has(name));
  const mismatched = [...expected.entries()].filter(([name, digest]) => actual.get(name) !== digest).map(([name]) => name);
  if (missing.length || extra.length || mismatched.length) {
    throw new Error(`Archive/source mismatch: missing=${missing.length}, extra=${extra.length}, hashMismatch=${mismatched.length}`);
  }
  const checksum = fs.readFileSync(checksumPath, "utf8").trim();
  if (checksum !== `${inspection.archiveSha256}  ${releasePolicy.archiveName}`) throw new Error("Release checksum file does not match the archive.");
  const sbomText = fs.readFileSync(sbomPath, "utf8");
  const sbom = JSON.parse(sbomText);
  if (sbom.bomFormat !== "CycloneDX" || sbom.specVersion !== "1.5" || !Array.isArray(sbom.components)) throw new Error("Invalid CycloneDX SBOM evidence.");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.archiveSha256 !== inspection.archiveSha256) throw new Error("Release manifest archive checksum drifted.");
  if (manifest.sourceFileCount !== sourceFiles.length) throw new Error("Release manifest source file count drifted.");
  if (manifest.sbom?.sha256 !== sha256(Buffer.from(sbomText))) throw new Error("Release manifest SBOM checksum drifted.");
  if (manifest.sbom?.componentCount !== sbom.components.length) throw new Error("Release manifest SBOM component count drifted.");
  return { inspection, sourceFileCount: sourceFiles.length, componentCount: sbom.components.length, manifest };
}

export function isForbiddenArchiveEntry(entryName) {
  if (!entryName || entryName.includes("\\") || entryName.startsWith("/")) return true;
  const normalized = entryName.replace(/^\/+|\/+$/gu, "");
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return true;
  if (parts[0] !== releasePolicy.rootDirectory) return true;
  const relativeParts = parts.slice(1);
  if (relativeParts.some((part) => releasePolicy.excludedDirectories.includes(part))) return true;
  const name = relativeParts.at(-1) ?? "";
  if (releasePolicy.excludedFiles.includes(name)) return true;
  if ((releasePolicy.excludedSuffixes ?? []).some((suffix) => name.endsWith(suffix))) return true;
  const allowedEnvironmentFiles = new Set(releasePolicy.allowedEnvironmentFiles ?? []);
  if (!allowedEnvironmentFiles.has(name) && (releasePolicy.excludedEnvironmentPatterns ?? []).some((source) => new RegExp(source, "u").test(name))) return true;
  return false;
}

function packageNameFromLockPath(packagePath) {
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  return index >= 0 ? packagePath.slice(index + marker.length) : packagePath;
}

function encodePackageName(name) {
  return name.startsWith("@") ? name.split("/").map(encodeURIComponent).join("/") : encodeURIComponent(name);
}

function integrityHash(integrity) {
  const separator = integrity.indexOf("-");
  const algorithm = separator >= 0 ? integrity.slice(0, separator).toLowerCase() : "sha512";
  const content = separator >= 0 ? integrity.slice(separator + 1) : integrity;
  const algorithmMap = { sha1: "SHA-1", sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
  return { alg: algorithmMap[algorithm] ?? "SHA-512", content };
}

function uuidFromHash(hash) {
  const value = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return value;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found.");
}
