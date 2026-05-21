import { StartedWeaviateContainer, WeaviateContainer } from '@testcontainers/weaviate';
import { Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import weaviate from '../../../src/index.js';

// Helper to spin up a container and return a connected client.
async function startContainer(
  image: string,
  env: Record<string, string> = {},
  platform?: string
): Promise<{ container: StartedWeaviateContainer }> {
  let builder = new WeaviateContainer(image)
    .withWaitStrategy(Wait.forHttp('/v1/.well-known/ready', 8080).withStartupTimeout(60 * 1000))
    .withExposedPorts(8080, 50051)
    .withEnvironment({
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true',
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate',
      ...env,
    });
  if (platform) {
    builder = builder.withPlatform(platform) as typeof builder;
  }
  const container = await builder.start();
  return { container };
}

// ─────────────────────────────────────────────────────────────────────────────
// Server 1.37.4 — old server that does NOT apply a server-side default.
// The client must inject vectorIndexType = 'hnsw' for each vector that has
// no explicit choice.
// ─────────────────────────────────────────────────────────────────────────────
describe('defaultVectorIndexType — legacy server (1.37.4)', () => {
  let container: StartedWeaviateContainer;

  beforeAll(async () => {
    ({ container } = await startContainer('semitechnologies/weaviate:1.37.4'));
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('no-explicit-index, selfProvided vectorizer → stored type is hnsw (client injected)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_Legacy_Self_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided(),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.default.indexType).toEqual('hnsw');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('no-explicit-index, named selfProvided vector → stored type is hnsw (client injected)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_Legacy_Named_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided({ name: 'main' }),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.main.indexType).toEqual('hnsw');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('explicit flat index, selfProvided vectorizer → stored type is flat (explicit choice preserved)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_Legacy_Flat_${Date.now()}`;
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

  it('explicit flat index, named selfProvided vector → stored type is flat (explicit choice preserved)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_Legacy_NamedFlat_${Date.now()}`;
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

// ─────────────────────────────────────────────────────────────────────────────
// Server 1.37.5 with DEFAULT_VECTOR_INDEX=flat — new server that applies its
// own default. The client must NOT inject anything; the server returns 'flat'.
// ─────────────────────────────────────────────────────────────────────────────
describe('defaultVectorIndexType — new server (1.37.5) with DEFAULT_VECTOR_INDEX=flat', () => {
  let container: StartedWeaviateContainer;

  beforeAll(async () => {
    ({ container } = await startContainer(
      'semitechnologies/weaviate:1.37.5-e0fe0d5.amd64',
      { DEFAULT_VECTOR_INDEX: 'flat' },
      'linux/amd64'
    ));
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('no-explicit-index, selfProvided vectorizer → stored type is flat (server-side default applied)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_New_Self_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided(),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.default.indexType).toEqual('flat');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('no-explicit-index, named selfProvided vector → stored type is flat (server-side default applied)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_New_Named_${Date.now()}`;
    try {
      await client.collections.create({
        name,
        vectorizers: weaviate.configure.vectors.selfProvided({ name: 'main' }),
      });
      const config = await client.collections.use(name).config.get();
      expect(config.vectorizers.main.indexType).toEqual('flat');
    } finally {
      await client.collections.delete(name).catch(() => undefined);
    }
  });

  it('explicit flat index, selfProvided vectorizer → stored type is flat (explicit choice preserved)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_New_Flat_${Date.now()}`;
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

  it('explicit flat index, named selfProvided vector → stored type is flat (explicit choice preserved)', async () => {
    const client = await weaviate.connectToLocal({
      host: container.getHost(),
      port: container.getMappedPort(8080),
      grpcPort: container.getMappedPort(50051),
    });
    const name = `DefVit_New_NamedFlat_${Date.now()}`;
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
