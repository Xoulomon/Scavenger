import { int, oneOf, parseSchema, str } from '../src/config/env-schema';
import type { EnvIssue, EnvSource, Field } from '../src/config/env-schema';

function run<T>(field: Field<T>, env: EnvSource): { value: T; issues: EnvIssue[] } {
  const issues: EnvIssue[] = [];
  return { value: field(env, issues), issues };
}

describe('env schema helpers (#1786)', () => {
  describe('str', () => {
    it('returns the value when set', () => {
      expect(run(str('A', 'x'), { A: 'y' }).value).toBe('y');
    });

    it('falls back when missing or empty', () => {
      expect(run(str('A', 'x'), {}).value).toBe('x');
      expect(run(str('A', 'x'), { A: '' }).value).toBe('x');
    });

    it('uses the first alias that is set', () => {
      const field = str(['A', 'B'], 'x');
      expect(run(field, { A: 'first', B: 'second' }).value).toBe('first');
      expect(run(field, { B: 'second' }).value).toBe('second');
      expect(run(field, { A: '', B: 'second' }).value).toBe('second');
    });
  });

  describe('int', () => {
    it('parses an integer', () => {
      expect(run(int('N', 5), { N: '42' })).toEqual({ value: 42, issues: [] });
    });

    it('falls back silently when missing or empty', () => {
      expect(run(int('N', 5), {})).toEqual({ value: 5, issues: [] });
      expect(run(int('N', 5), { N: '' })).toEqual({ value: 5, issues: [] });
    });

    it('falls back and reports a non-numeric value instead of returning NaN', () => {
      const { value, issues } = run(int('N', 5), { N: 'abc' });
      expect(value).toBe(5);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.variable).toBe('N');
      expect(issues[0]?.message).toContain('not an integer');
    });

    it('enforces min and max and accepts the bounds', () => {
      const field = int('N', 5, { min: 1, max: 10 });
      expect(run(field, { N: '0' }).value).toBe(5);
      expect(run(field, { N: '11' }).value).toBe(5);
      expect(run(field, { N: '0' }).issues[0]?.message).toContain('out of range');
      expect(run(field, { N: '1' }).value).toBe(1);
      expect(run(field, { N: '10' }).value).toBe(10);
    });

    it('reports the alias that was actually used', () => {
      const { issues } = run(int(['A', 'B'], 5), { B: 'nope' });
      expect(issues[0]?.variable).toBe('B');
    });
  });

  describe('oneOf', () => {
    const field = oneOf('F', ['json', 'pretty'] as const, 'json');

    it('accepts an allowed value', () => {
      expect(run(field, { F: 'pretty' })).toEqual({ value: 'pretty', issues: [] });
    });

    it('falls back silently when unset', () => {
      expect(run(field, {})).toEqual({ value: 'json', issues: [] });
    });

    it('falls back and reports an unknown value', () => {
      const { value, issues } = run(field, { F: 'xml' });
      expect(value).toBe('json');
      expect(issues[0]?.message).toContain('json, pretty');
    });
  });

  describe('parseSchema', () => {
    const schema = {
      a: { n: int('N', 1), s: str('S', 'd') },
      mode: oneOf('M', ['x', 'y'] as const, 'x'),
    };

    it('builds a typed nested object', () => {
      const { value, issues } = parseSchema(schema, { N: '7', S: 'v', M: 'y' });
      const n: number = value.a.n;
      const mode: 'x' | 'y' = value.mode;
      expect(n).toBe(7);
      expect(value.a.s).toBe('v');
      expect(mode).toBe('y');
      expect(issues).toEqual([]);
    });

    it('collects every issue in one pass and does not mutate the environment', () => {
      const env = { N: 'bad', M: 'z' };
      const { value, issues } = parseSchema(schema, env);
      expect(value).toEqual({ a: { n: 1, s: 'd' }, mode: 'x' });
      expect(issues.map((issue) => issue.variable).sort()).toEqual(['M', 'N']);
      expect(env).toEqual({ N: 'bad', M: 'z' });
    });
  });
});
