import { compile } from '@typescript-eslint/rule-schema-to-typescript-types';
import fs from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';

import rules from '../src/rules/index';
import { areOptionsValid } from './areOptionsValid';

const snapshotFolder = path.resolve(__dirname, 'schema-snapshots');
try {
  fs.mkdirSync(snapshotFolder);
} catch {
  // ignore failure as it means it already exists probably
}

const PRETTIER_CONFIG_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '.prettierrc.json',
);
const SCHEMA_FILEPATH = path.join(__dirname, 'schema.json');
const TS_TYPE_FILEPATH = path.join(__dirname, 'schema.ts');
const getPrettierConfig = async (
  filepath: string,
): Promise<prettier.Options> => {
  const config = await prettier.resolveConfig(filepath, {
    config: PRETTIER_CONFIG_PATH,
  });
  if (config == null) {
    throw new Error('Unable to resolve prettier config');
  }
  return {
    ...config,
    filepath,
  };
};
const PRETTIER_CONFIG = {
  schema: getPrettierConfig(SCHEMA_FILEPATH),
  tsType: getPrettierConfig(TS_TYPE_FILEPATH),
};

const SKIPPED_RULES_FOR_TYPE_GENERATION = new Set(['indent']);
// Set this to a rule name to only run that rule
const ONLY = '';

describe('Rule schemas should be convertible to TS types for documentation purposes', () => {
  // eslint-disable-next-line vitest/prefer-each
  for (const [ruleName, ruleDef] of Object.entries(rules)) {
    if (SKIPPED_RULES_FOR_TYPE_GENERATION.has(ruleName)) {
      // eslint-disable-next-line vitest/no-disabled-tests
      it.skip(ruleName, () => {});
      continue;
    }

    (ruleName === ONLY ? it.only : it)(ruleName, async () => {
      const schemaString = await prettier.format(
        JSON.stringify(
          ruleDef.meta.schema,
          (k, v: unknown) => {
            if (k === 'enum' && Array.isArray(v)) {
              // sort enum arrays for consistency regardless of source order
              v.sort();
            } else if (
              typeof v === 'object' &&
              v != null &&
              !Array.isArray(v)
            ) {
              // sort properties for consistency regardless of source order
              return Object.fromEntries(
                Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
              );
            }
            return v;
          },
          // use the indent feature as it forces all objects to be multiline
          // if we don't do this then prettier decides what objects are multiline
          // based on what fits on a line - which looks less consistent
          // and makes changes harder to understand as you can have multiple
          // changes per line, or adding a prop can restructure an object
          2,
        ),
        await PRETTIER_CONFIG.schema,
      );
      const compilationResult = await compile(
        ruleDef.meta.schema,
        PRETTIER_CONFIG.tsType,
      );

      await expect(
        [
          '',
          '# SCHEMA:',
          '',
          schemaString,
          '',
          '# TYPES:',
          '',
          compilationResult,
        ].join('\n'),
      ).toMatchFileSnapshot(path.join(snapshotFolder, `${ruleName}.shot`));
    });
  }
});

test('There should be no old snapshots for rules that have been deleted', () => {
  const files = fs.readdirSync(snapshotFolder);
  const names = new Set(
    Object.keys(rules)
      .filter(k => !SKIPPED_RULES_FOR_TYPE_GENERATION.has(k))
      .map(k => `${k}.shot`),
  );

  for (const file of files) {
    expect(names).toContain(file);
  }
});

const VALID_SCHEMA_PROPS = new Set([
  '$defs',
  '$ref',
  '$schema',
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'default',
  'definitions',
  'dependencies',
  'description',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'extends',
  'format',
  'id',
  'items',
  'maximum',
  'maxItems',
  'maxLength',
  'maxProperties',
  'minimum',
  'minItems',
  'minLength',
  'minProperties',
  'multipleOf',
  'not',
  'oneOf',
  'pattern',
  'patternProperties',
  'properties',
  'required',
  'title',
  'type',
  'uniqueItems',
]);
describe('Rules should only define valid keys on schemas', () => {
  for (const [ruleName, ruleDef] of Object.entries(rules)) {
    (ruleName === ONLY ? it.only : it)(ruleName, () => {
      JSON.stringify(ruleDef.meta.schema, (key, value: unknown) => {
        if (key === '') {
          // the root object will have key ""
          return value;
        }
        if (key === '$defs' || key === 'definitions' || key === 'properties') {
          // definition keys and property keys should not be validated, only the values
          return Object.values(value as object);
        }
        if (`${Number(key)}` === key) {
          // hack to detect arrays as JSON.stringify will traverse them and stringify the number
          return value;
        }

        expect(VALID_SCHEMA_PROPS).toContain(key);
        return value;
      });
    });
  }
});

describe('Rule schemas should validate options correctly', () => {
  // Normally, we use the rule's default options as an example of valid options.
  // However, the defaults might not actually be valid (especially in the case
  // where the defaults have to cover multiple incompatible options).
  // This override allows providing example valid options for rules which don't
  // accept their defaults.
  const overrideValidOptions: Record<string, unknown> = {
    'func-call-spacing': ['never'],
    semi: ['never'],
  };

  const ruleEntries = Object.entries(rules);

  test.each(ruleEntries)('%s must accept valid options', (ruleName, rule) => {
    if (
      !areOptionsValid(
        rule,
        overrideValidOptions[ruleName] ?? rule.defaultOptions,
      )
    ) {
      throw new Error(`Options failed validation against rule's schema`);
    }
  });

  test.each(ruleEntries)('%s rejects arbitrary options', (_ruleName, rule) => {
    if (areOptionsValid(rule, [{ 'arbitrary-schemas.test.ts': true }])) {
      throw new Error(`Options succeeded validation for arbitrary options`);
    }
  });
});
