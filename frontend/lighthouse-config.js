module.exports = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4
    },
    skipAudits: ['canonical', 'unsized-images']
  },
  audits: [
    {
      path: 'lighthouse/audits/metrics',
      options: {
        timing: true
      }
    }
  ]
}
