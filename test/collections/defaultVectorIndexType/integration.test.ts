import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import weaviate, { WeaviateClient } from '../../../src/index.js';
import { DbVersion } from '../../../src/utils/dbVersion.js';

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describe('defaultVectorIndexType', () => {
  let client: WeaviateClient;
  let serverVersion: DbVersion;
  let expectedDefaultIndexType: 'hnsw' | 'hfresh';

  beforeAll(async () => {
    client = await weaviate.connectToLocal();
    const meta = await client.getMeta();
    if (!meta.version) {
      throw new Error('Weaviate meta endpoint did not return a version');
    }
    serverVersion = DbVersion.fromString(meta.version);
    expectedDefaultIndexType = serverVersion.isAtLeast(1, 37, 5) ? 'hfresh' : 'hnsw';
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
      expect(config.vectorizers.default.indexType).toEqual(expectedDefaultIndexType);
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
      expect(config.vectorizers.main.indexType).toEqual(expectedDefaultIndexType);
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
