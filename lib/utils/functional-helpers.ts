/**
 * Functional programming utilities for SHACL to ShEx conversion
 */

/**
 * Pipe function - compose functions from left to right
 */
export const pipe = <T>(...fns: Array<(arg: T) => T>) => (value: T): T =>
  fns.reduce((acc, fn) => fn(acc), value);

/**
 * Compose function - compose functions from right to left
 */
export const compose = <T>(...fns: Array<(arg: T) => T>) => (value: T): T =>
  fns.reduceRight((acc, fn) => fn(acc), value);

/**
 * Map over object entries
 */
export const mapObject = <T, U>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => U
): Record<string, U> =>
  Object.entries(obj).reduce(
    (acc, [key, value]) => ({ ...acc, [key]: fn(value, key) }),
    {} as Record<string, U>
  );

/**
 * Filter object entries
 */
export const filterObject = <T>(
  obj: Record<string, T>,
  predicate: (value: T, key: string) => boolean
): Record<string, T> =>
  Object.entries(obj).reduce(
    (acc, [key, value]) => 
      predicate(value, key) ? { ...acc, [key]: value } : acc,
    {} as Record<string, T>
  );

/**
 * Maybe monad for handling optional values
 */
export class Maybe<T> {
  private constructor(private value: T | null | undefined) {}

  static of<T>(value: T | null | undefined): Maybe<T> {
    return new Maybe(value);
  }

  static none<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  isNone(): boolean {
    return this.value === null || this.value === undefined;
  }

  isSome(): boolean {
    return !this.isNone();
  }

  map<U>(fn: (value: T) => U): Maybe<U> {
    return this.isNone() ? Maybe.none<U>() : Maybe.of(fn(this.value as T));
  }

  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return this.isNone() ? Maybe.none<U>() : fn(this.value as T);
  }

  filter(predicate: (value: T) => boolean): Maybe<T> {
    return this.isNone() || !predicate(this.value as T) 
      ? Maybe.none<T>() 
      : this;
  }

  getOrElse(defaultValue: T): T {
    return this.isNone() ? defaultValue : (this.value as T);
  }

  orElse(alternative: () => Maybe<T>): Maybe<T> {
    return this.isNone() ? alternative() : this;
  }
}

/**
 * Result type for handling errors functionally
 */
export type Result<T, E> = 
  | { kind: 'ok'; value: T }
  | { kind: 'error'; error: E };

export const Result = {
  ok<T, E>(value: T): Result<T, E> {
    return { kind: 'ok', value };
  },

  error<T, E>(error: E): Result<T, E> {
    return { kind: 'error', error };
  },

  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.kind === 'ok' 
      ? Result.ok(fn(result.value))
      : result;
  },

  flatMap<T, U, E>(
    result: Result<T, E>, 
    fn: (value: T) => Result<U, E>
  ): Result<U, E> {
    return result.kind === 'ok' ? fn(result.value) : result;
  },

  mapError<T, E, F>(
    result: Result<T, E>, 
    fn: (error: E) => F
  ): Result<T, F> {
    return result.kind === 'error'
      ? Result.error(fn(result.error))
      : result;
  },

  isOk<T, E>(result: Result<T, E>): result is { kind: 'ok'; value: T } {
    return result.kind === 'ok';
  },

  isError<T, E>(result: Result<T, E>): result is { kind: 'error'; error: E } {
    return result.kind === 'error';
  }
};

/**
 * Collect results from an array of Results
 */
export const collectResults = <T, E>(
  results: Result<T, E>[]
): Result<T[], E> => {
  const values: T[] = [];
  
  for (const result of results) {
    if (Result.isError(result)) {
      return result;
    }
    values.push(result.value);
  }
  
  return Result.ok(values);
};

/**
 * Memoize function results
 */
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Curry a function
 */
export const curry = <T extends (...args: any[]) => any>(
  fn: T,
  arity = fn.length
): any => {
  return function curried(...args: any[]): any {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  };
};

/**
 * Partial application
 */
export const partial = <T extends (...args: any[]) => any>(
  fn: T,
  ...partialArgs: Partial<Parameters<T>>
): (...args: any[]) => ReturnType<T> => {
  return (...args: any[]) => fn(...partialArgs, ...args);
};

/**
 * Identity function
 */
export const identity = <T>(x: T): T => x;

/**
 * Constant function
 */
export const constant = <T>(x: T) => (): T => x;

/**
 * Flatten nested arrays
 */
export const flatten = <T>(arr: T[][]): T[] => 
  arr.reduce((acc, val) => acc.concat(val), []);

/**
 * Group array elements by key
 */
export const groupBy = <T>(
  arr: T[],
  keyFn: (item: T) => string
): Record<string, T[]> =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    return {
      ...acc,
      [key]: [...(acc[key] || []), item]
    };
  }, {} as Record<string, T[]>);

/**
 * Unique array elements
 */
export const unique = <T>(
  arr: T[],
  keyFn: (item: T) => string = JSON.stringify
): T[] => {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};