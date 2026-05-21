import { StartedWeaviateContainer, WeaviateContainer } from '@testcontainers/weaviate';
import { Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import weaviate from '../../../src/index.js';
import { DbVersion } from '../../../src/utils/dbVersion.js';

// ─────────────────────────────────────────────────────────────────────────────
// Version resolution
//
// WEAVIATE_VERSION follows the existing convention (see test/version.ts).
// Default to 1.37.5-e0fe0d5.amd64 so a bare local run targets the new server.
// ─────────────────────────────────────────────────────────────────────────────
const WEAVIATE_VERSION = process.env.WEAVIATE_VERSION ?? '1.37.5-e0fe0d5.amd64';
const expectedDefault = process.env.DEFAULT_VECTOR_INDEX ?? 'hfresh';

// Strip a trailing ".amd64" / ".arm64" platform suffix before parsing:
// DbVersion.fromString understands semver pre-release labels (e.g. -e0fe0d5)
// but not dot-separated platform tokens appended after them.
const versionForParsing = WEAVIATE_VERSION.replace(/\.(amd64|arm64|x86_64)$/, '');
const parsedVersion = DbVersion.fromString(`v${versionForParsing}`);

// >= 1.37.5: server applies DEFAULT_VECTOR_INDEX itself; client must NOT inject.
// <  1.37.5: server has no such feature; client injects vectorIndexType = 'hnsw'.
const serverAppliesDefault = parsedVersion.isAtLeast(1, 37, 5);

// Use a linux/amd64 platform pin only when the image tag carries the ".amd64"
// suffix — same narrowing the old test did, now applied to a single version.
const platform = WEAVIATE_VERSION.includes('.amd64') ? 'linux/amd64' : undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Container helper
// ─────────────────────────────────────────────────────────────────────────────
async function startContainer(
  image: string,
  env: Record<string, string> = {},
  containerPlatform?: string
): Promise<{ container: StartedWeaviateContainer }> {
  let builder = new WeaviateContainer(image)
    .withWaitStrategy(Wait.forHttp('/v1/.well-known/ready', 8080).withStartupTimeout(60 * 1000))
    .withExposedPorts(8080, 50051)
    .withEnvironment({
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true',
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate',
      ...env,
    });
  if (containerPlatform) {
    builder = builder.withPlatform(containerPlatform) as typeof builder;
  }
  const container = await builder.start();
  return { container };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describe(`defaultVectorIndexType — server ${WEAVIATE_VERSION} (serverAppliesDefault=${serverAppliesDefault})`, () => {
  let container: StartedWeaviateContainer;

  beforeAll(async () => {
    ({ container } = await startContainer(
      `semitechnologies/weaviate:${WEAVIATE_VERSION}`,
      // Older servers ignore unknown env vars; always pass the flag so we don't
      // need a separate image-launch path.
      { DEFAULT_VECTOR_INDEX: expectedDefault },
      platform
    ));
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  // ── Scenario A: no explicit vectorIndexConfig ──────────────────────────────

  it('Scenario A — selfProvided (default vector), no explicit index config', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_A_Self_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided(),
      });
      const config = await client.collections.use(name).config.get();
      // New server: DEFAULT_VECTOR_INDEX=flat propagates → 'flat'
      // Old server: client injected 'hnsw' as the safe fallback
      expect(config.vectorizers.default.indexType).toEqual(serverAppliesDefault ? expectedDefault : 'hnsw');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('Scenario A — selfProvided (named vector "main"), no explicit index config', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_A_Named_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided({ name: 'main' }),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.main.indexType).toEqual(serverAppliesDefault ? expectedDefault : 'hnsw');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  // ── Scenario B: explicit flat vectorIndexConfig ────────────────────────────
  // Explicit choice must be preserved on every version.

  it('Scenario B — selfProvided (default vector), explicit flat index config', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_B_Self_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided({
          vectorIndexConfig: weaviate.configure.vectorIndex.flat(),
        }),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.default.indexType).toEqual('flat');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('Scenario B — selfProvided (named vector "main"), explicit flat index config', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_B_Named_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided({
          name: 'main',
          vectorIndexConfig: weaviate.configure.vectorIndex.flat(),
        }),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.main.indexType).toEqual('flat');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });
}, 180_000);
