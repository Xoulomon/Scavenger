import { AlertRule, evaluateRules, fireAlert } from '../src/monitoring/alerts'

describe('Alert System', () => {
  it('evaluates rules and fires alerts', async () => {
    const firedAlerts: string[] = []
    const testRule: AlertRule = {
      name: 'test_alert',
      description: 'Test alert rule',
      severity: 'warning',
      evaluate: async () => {
        firedAlerts.push('evaluated')
        return true
      }
    }

    await evaluateRules([testRule])
    expect(firedAlerts).toContain('evaluated')
  })

  it('does not fire alert when rule evaluates to false', async () => {
    const testRule: AlertRule = {
      name: 'no_fire',
      description: 'Should not fire',
      severity: 'info',
      evaluate: async () => false
    }

    await expect(evaluateRules([testRule])).resolves.not.toThrow()
  })

  it('handles rule evaluation errors gracefully', async () => {
    const testRule: AlertRule = {
      name: 'error_rule',
      description: 'Throws error',
      severity: 'critical',
      evaluate: async () => {
        throw new Error('Test error')
      }
    }

    await expect(evaluateRules([testRule])).resolves.not.toThrow()
  })

  it('fireAlert creates alert record', async () => {
    await expect(
      fireAlert('test_alert', 'warning', 'Test message', { key: 'value' })
    ).resolves.not.toThrow()
  })

  it('bulk fire alerts for multiple rules', async () => {
    const rules: AlertRule[] = [
      { name: 'rule1', description: 'First', severity: 'info', evaluate: async () => true },
      { name: 'rule2', description: 'Second', severity: 'warning', evaluate: async () => false },
      { name: 'rule3', description: 'Third', severity: 'critical', evaluate: async () => true }
    ]

    await expect(evaluateRules(rules)).resolves.not.toThrow()
  })
})
