import { isValidStringArray, isValidStringProperty } from '../validation/string';

export default class GraphQLBm25 {
  private properties?: string[];
  private query?: string;
  private source: any;

  constructor(bm25Obj: any) {
    this.source = bm25Obj;
  }

  toString() {
    this.parse();
    this.validate();

    let args = [`query:${JSON.stringify(this.query)}`]; // query must always be set

    if (this.properties !== undefined) {
      args = [...args, `properties:${JSON.stringify(this.properties)}`];
    }

    return `{${args.join(',')}}`;
  }

  parse() {
    for (const key in this.source) {
      switch (key) {
        case 'query':
          this.parseQuery(this.source[key]);
          break;
        case 'properties':
          this.parseProperties(this.source[key]);
          break;
        default:
          throw new Error(`bm25 filter: unrecognized key '${key}'`);
      }
    }
  }

  parseQuery(query: string) {
    if (!isValidStringProperty(query)) {
      throw new Error('bm25 filter: query must be a string');
    }

    this.query = query;
  }

  parseProperties(properties: string[]) {
    if (!isValidStringArray(properties)) {
      throw new Error('bm25 filter: properties must be an array of strings');
    }

    this.properties = properties;
  }

  validate() {
    if (!this.query) {
      throw new Error('bm25 filter: query cannot be empty');
    }
  }
}
