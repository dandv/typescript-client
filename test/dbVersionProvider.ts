import { VersionProvider } from '../src/utils/dbVersion';

export class TestDbVersionProvider implements VersionProvider {
  private version: string;

  constructor(version: string) {
    this.version = version;
  }

  getVersionPromise(): Promise<string> {
    return Promise.resolve(this.version);
  }
}
