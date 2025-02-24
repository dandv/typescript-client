import { ApiKey, OidcAuthenticator } from './auth';
import OpenidConfigurationGetter from '../misc/openidConfigurationGetter';

import httpClient, { HttpClient } from './httpClient';
import gqlClient, { GraphQLClient } from './gqlClient';
import { ConnectionParams } from '../index';

export default class Connection {
  private apiKey?: string;
  private oidcAuth?: OidcAuthenticator;
  private authEnabled: boolean;
  private gql: GraphQLClient;
  public readonly http: HttpClient;

  constructor(params: ConnectionParams) {
    this.http = httpClient(params);
    this.gql = gqlClient(params);
    this.authEnabled = this.parseAuthParams(params);
  }

  private parseAuthParams(params: ConnectionParams): boolean {
    if (params.authClientSecret && params.apiKey) {
      throw new Error(
        'must provide one of authClientSecret (OIDC) or apiKey, cannot provide both'
      );
    }
    if (params.authClientSecret) {
      this.oidcAuth = new OidcAuthenticator(this.http, params.authClientSecret);
      return true;
    }
    if (params.apiKey) {
      this.apiKey = params.apiKey?.apiKey;
      return true;
    }
    return false;
  }

  post = (path: string, payload: any, expectReturnContent = true) => {
    if (this.authEnabled) {
      return this.login().then((token) =>
        this.http.post(path, payload, expectReturnContent, token)
      );
    }
    return this.http.post(path, payload, expectReturnContent);
  };

  put = (path: string, payload: any, expectReturnContent = true) => {
    if (this.authEnabled) {
      return this.login().then((token) =>
        this.http.put(path, payload, expectReturnContent, token)
      );
    }
    return this.http.put(path, payload, expectReturnContent);
  };

  patch = (path: string, payload: any) => {
    if (this.authEnabled) {
      return this.login().then((token) =>
        this.http.patch(path, payload, token)
      );
    }
    return this.http.patch(path, payload);
  };

  delete = (path: string, payload: any, expectReturnContent = false) => {
    if (this.authEnabled) {
      return this.login().then((token) =>
        this.http.delete(path, payload, expectReturnContent, token)
      );
    }
    return this.http.delete(path, payload, expectReturnContent);
  };

  head = (path: string, payload: any) => {
    if (this.authEnabled) {
      return this.login().then((token) => this.http.head(path, payload, token));
    }
    return this.http.head(path, payload);
  };

  get = (path: string, expectReturnContent = true) => {
    if (this.authEnabled) {
      return this.login().then((token) =>
        this.http.get(path, expectReturnContent, token)
      );
    }
    return this.http.get(path, expectReturnContent);
  };

  query = (query: any) => {
    if (this.authEnabled) {
      return this.login().then((token) => {
        const headers = { Authorization: `Bearer ${token}` };
        return this.gql.query(query, headers);
      });
    }
    return this.gql.query(query);
  };

  login = async () => {
    if (this.apiKey) {
      return this.apiKey;
    }

    if (!this.oidcAuth) {
      return '';
    }

    const localConfig = await new OpenidConfigurationGetter(this.http).do();

    if (localConfig === undefined) {
      console.warn(
        'client is configured for authentication, but server is not'
      );
      return '';
    }

    if (Date.now() >= this.oidcAuth.getExpiresAt()) {
      await this.oidcAuth.refresh(localConfig);
    }
    return this.oidcAuth.getAccessToken();
  };
}
