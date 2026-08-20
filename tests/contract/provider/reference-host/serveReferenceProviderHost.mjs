import { createReferenceProviderHost } from "./referenceProviderHost.mjs";

const host = createReferenceProviderHost();
const { baseUrl } = await host.start();
console.log(`UNICORE_REFERENCE_PROVIDER_BASE_URL=${baseUrl}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await host.stop();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
setInterval(() => {}, 60_000).unref();
