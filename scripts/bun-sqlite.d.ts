declare module "bun:sqlite" {
  interface Query<T = unknown> {
    get(...params: unknown[]): T | null;
  }

  export default class Database {
    constructor(
      filename: string,
      options?: {
        create?: boolean;
      }
    );

    close(): void;
    prepare(sql: string): {
      run(...params: unknown[]): void;
    };
    query<T = unknown>(sql: string): Query<T>;
    run(sql: string): void;
  }
}
