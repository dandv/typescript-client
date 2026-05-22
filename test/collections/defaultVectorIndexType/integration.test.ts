import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import weaviate, { WeaviateClient } from '../../../src/index.js';
import { DbVersion } from '../../../src/utils/dbVersion.js';

let client: WeaviateClient;
let serverVersion: DbVersion;

function expectedDefaultIndexType(version: DbVersion): 'hnsw' | 'hfresh' {
  // 1.38+ defaults to hfresh; older versions default to hnsw.
  return version.isAtLeast(1, 38, 0) ? 'hfresh' : 'hnsw';
}

/**
 * Assert that a collection's stored index type matches what the server/client
 * should have applied given the running version:
 *   - on newer servers, expect hfresh default
 *   - on older servers, expect legacy hnsw default
 */
function assertDefaultIndexType(actual: string) {
  expect(actual).toEqual(expectedDefaultIndexType(serverVersion));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describe('defaultVectorIndexType', () => {
  beforeAll(async () => {
    client = await weaviate.connectToLocal();
    const meta = await client.getMeta();
    if (!meta.version) {
      throw new Error('Weaviate meta endpoint did not return a version');
    }
    serverVersion = DbVersion.fromString(meta.version);
  }, 60_000);

  afterAll(async () => {
    await client?.close();
  });

  // ── Scenario A: no explicit vectorIndexConfig ──────────────────────────────

  it('Scenario A — selfProvided (default vector), no explicit index config', async () => {
    const name = `DefaultVectorIndexType_A_Self_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided(),
      });
      const config = await client.collections.use(name).config.get();
      assertDefaultIndexType(config.vectorizers.default.indexType);
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('Scenario A — selfProvided (named vector "main"), no explicit index config', async () => {
    const name = `DefaultVectorIndexType_A_Named_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided({ name: 'main' }),
      });
      const config = await client.collections.use(name).config.get();
      assertDefaultIndexType(config.vectorizers.main.indexType);
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  // ── Scenario B: explicit flat vectorIndexConfig ────────────────────────────
  // Explicit choice must be preserved on every version.

  it('Scenario B — selfProvided (default vector), explicit flat index config', async () => {
    const name = `DefaultVectorIndexType_B_Self_${Date.now()}`;
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
    const name = `DefaultVectorIndexType_B_Named_${Date.now()}`;
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
}, 120_000);
