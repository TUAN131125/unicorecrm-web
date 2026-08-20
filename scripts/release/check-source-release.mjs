import { verifyReleaseEvidence } from "./source-release.mjs";

const result = verifyReleaseEvidence();
console.log(`[release-check] PASS — ${result.sourceFileCount} source files, ${result.componentCount} SBOM components, archive SHA-256 ${result.inspection.archiveSha256}.`);
