/** Outcome of an operation that can fail with user-facing (Japanese) error messages. */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(...errors: string[]): Result<T> {
  return { ok: false, errors };
}
