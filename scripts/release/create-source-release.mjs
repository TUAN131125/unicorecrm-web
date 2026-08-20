import { writeReleaseEvidence } from "./source-release.mjs";

const result = writeReleaseEvidence();
console.log(`[release] PASS — ${result.manifest.sourceFileCount} source files, archive SHA-256 ${result.manifest.archiveSha256}, ${result.manifest.sbom.componentCount} SBOM components.`);
