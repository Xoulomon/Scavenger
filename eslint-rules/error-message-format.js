module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce consistent error message format',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    const vaguePatterns = [
      /error/i,
      /something went wrong/i,
      /unexpected/i,
    ];

    function checkMessage(node, message) {
      if (!message || typeof message !== 'string') return;

      const issues = [];

      if (message.length > 0 && message[0] !== message[0].toUpperCase()) {
        issues.push('Message must start with a capital letter');
      }

      if (message.length > 0 && !message.endsWith('.')) {
        issues.push('Message must end with a period');
      }

      for (const pattern of vaguePatterns) {
        if (pattern.test(message) && message.length < 30) {
          issues.push('Message may be too vague');
          break;
        }
      }

      if (issues.length > 0) {
        context.report({
          node,
          message: `Error message format issues: ${issues.join('; ')}`,
        });
      }
    }

    return {
      NewExpression(node) {
        if (node.callee.name === 'Error' || node.callee.name === 'AppError') {
          const messageArg = node.arguments[0];
          if (messageArg && messageArg.type === 'Literal' && typeof messageArg.value === 'string') {
            checkMessage(messageArg, messageArg.value);
          }
        }
      },
    };
  },
};
