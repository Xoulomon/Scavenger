// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Scavngr Docs',
  tagline: 'Decentralized Recycling Platform on Stellar',
  favicon: 'img/favicon.ico',

  url: 'https://docs.scavngr.io',
  baseUrl: '/',

  organizationName: 'Xoulomon',
  projectName: 'Scavenger',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Xoulomon/Scavenger/edit/main/website/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        },
        gtag: {
          trackingID: 'G-PLACEHOLDER',
          anonymizeIP: true
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5
        }
      })
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true
      },
      navbar: {
        title: 'Scavngr',
        logo: {
          alt: 'Scavngr Logo',
          src: 'img/logo.svg'
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs'
          },
          {
            href: 'https://github.com/Xoulomon/Scavenger',
            label: 'GitHub',
            position: 'right'
          }
        ]
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/intro' },
              { label: 'Contributing', to: '/docs/contributing/style-guide' },
              { label: 'Deployment', to: '/docs/deployment/ci-cd' }
            ]
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/Xoulomon/Scavenger' },
              { label: 'Discussions', href: 'https://github.com/Xoulomon/Scavenger/discussions' }
            ]
          },
          {
            title: 'More',
            items: [{ label: 'Contributing', to: '/docs/contributing/style-guide' }]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Scavngr. Built with Docusaurus.`
      },
      algolia: {
        appId: 'PLACEHOLDER_APP_ID',
        apiKey: 'PLACEHOLDER_SEARCH_KEY',
        indexName: 'scavngr',
        contextualSearch: true
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['rust', 'toml', 'bash']
      }
    })
}

module.exports = config
