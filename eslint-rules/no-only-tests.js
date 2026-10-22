/**
 * Disallow `.only` on test hooks (`describe`, `it`, `test`, `context`, `suite`).
 *
 * A committed `.only` silently disables the rest of the suite, hiding real
 * failures. This rule surfaces it as an error so it can never reach CI.
 *
 * Mirrors the behaviour of eslint-plugin-no-only-tests without the extra
 * dependency.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow `.only` on test hooks',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    const testHooks = new Set([
      'describe',
      'context',
      'suite',
      'it',
      'test',
      'specify',
    ]);

    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (node.property.name !== 'only') return;

        const objectName =
          node.object && node.object.type === 'Identifier'
            ? node.object.name
            : null;

        if (objectName && testHooks.has(objectName)) {
          context.report({
            node: node.property,
            message: '`{{name}}.only` is not allowed — remove it before committing.',
            data: { name: objectName },
          });
        }
      },
    };
  },
};
