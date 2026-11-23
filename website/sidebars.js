// @ts-check
//
// Only reference docs that exist under website/docs/.
// Linking to a non-existent page causes `docusaurus build` to throw
// "broken link" errors and fail CI (issue #1785 cleanup).
//
// To add a new page: create the .md file under website/docs/ first,
// then add its id here.
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Contributing',
      items: ['contributing/style-guide']
    },
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/ci-cd']
    }
  ]
}

module.exports = sidebars
