/**
 * #1786: Dependency-free, typed environment-variable schema helpers.
 *
 * A schema is a (nested) object of fields. Each field reads one variable (or a
 * list of aliases, first one set wins), applies a default, and returns a typed
 * value. Invalid values never throw and never produce NaN: they fall back to
 * the default and are recorded as issues so startup can report them.
 *
 * The helpers take the environment as an argument so they can be unit-tested
 * without touching `process.env`.
 */

export type EnvSource = Record<string, string | undefined>;

export interface EnvIssue {
  variable: string;
  message: string;
}

export type Field<T> = (env: EnvSource, issues: EnvIssue[]) => T;

export interface SchemaShape {
  [key: string]: Field<unknown> | SchemaShape;
}

export type Infer<S> = {
  [K in keyof S]: S[K] extends Field<infer T> ? T : Infer<S[K]>;
};

type Names = string | readonly string[];

function firstSet(env: EnvSource, names: Names): { name: string; value: string } | undefined {
  for (const name of typeof names === 'string' ? [names] : names) {
    const value = env[name];
    if (value !== undefined && value !== '') {
      return { name, value };
    }
  }
  return undefined;
}

/** A string variable. Missing or empty values use the fallback. */
export function str(names: Names, fallback: string): Field<string> {
  return (env) => firstSet(env, names)?.value ?? fallback;
}

export interface IntOptions {
  min?: number;
  max?: number;
}

/** An integer variable. Non-numeric or out-of-range values use the fallback. */
export function int(names: Names, fallback: number, options: IntOptions = {}): Field<number> {
  return (env, issues) => {
    const found = firstSet(env, names);
    if (!found) {
      return fallback;
    }
    const parsed = parseInt(found.value, 10);
    if (!Number.isFinite(parsed)) {
      issues.push({
        variable: found.name,
        message: `"${found.value}" is not an integer; using ${fallback}`,
      });
      return fallback;
    }
    const belowMin = options.min !== undefined && parsed < options.min;
    const aboveMax = options.max !== undefined && parsed > options.max;
    if (belowMin || aboveMax) {
      issues.push({
        variable: found.name,
        message: `${parsed} is out of range; using ${fallback}`,
      });
      return fallback;
    }
    return parsed;
  };
}

/** A variable restricted to a fixed set of values. Unknown values use the fallback. */
export function oneOf<T extends string>(
  names: Names,
  allowed: readonly T[],
  fallback: T,
): Field<T> {
  return (env, issues) => {
    const found = firstSet(env, names);
    if (!found) {
      return fallback;
    }
    const match = allowed.find((candidate) => candidate === found.value);
    if (match === undefined) {
      issues.push({
        variable: found.name,
        message: `"${found.value}" is not one of ${allowed.join(', ')}; using ${fallback}`,
      });
      return fallback;
    }
    return match;
  };
}

/** Evaluate a schema against an environment, returning typed values and any issues. */
export function parseSchema<S extends SchemaShape>(
  schema: S,
  env: EnvSource,
): { value: Infer<S>; issues: EnvIssue[] } {
  const issues: EnvIssue[] = [];
  const build = (shape: SchemaShape): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(shape)) {
      out[key] = typeof entry === 'function' ? entry(env, issues) : build(entry);
    }
    return out;
  };
  return { value: build(schema) as unknown as Infer<S>, issues };
}
