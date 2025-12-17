// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'OSO Kafka Backup',
  tagline: 'High-performance backup and restore for Apache Kafka',
  favicon: 'img/favicon.ico',
  url: 'https://kafkabackup.com',
  baseUrl: '/',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/osodevops/kafka-backup-docs/tree/main/docs/',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/kafka-backup-social-card.png',
      navbar: {
        title: 'OSO Kafka Backup',
        logo: {
          alt: 'OSO Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/osodevops/kafka-backup',
            label: 'GitHub',
            position: 'right',
          },
          {
            href: 'https://www.oso.sh',
            label: 'OSO',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/getting-started',
              },
              {
                label: 'Deployment',
                to: '/deployment',
              },
              {
                label: 'CLI Reference',
                to: '/reference/cli-reference',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/osodevops/kafka-backup',
              },
              {
                label: 'Issues',
                href: 'https://github.com/osodevops/kafka-backup/issues',
              },
              {
                label: 'Discussions',
                href: 'https://github.com/osodevops/kafka-backup/discussions',
              },
            ],
          },
          {
            title: 'Enterprise',
            items: [
              {
                label: 'Contact Sales',
                href: 'https://www.oso.sh/contact',
              },
              {
                label: 'Enterprise Features',
                to: '/enterprise',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} OSO. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'yaml', 'json', 'rust', 'toml'],
      },
    }),
};

export default config;
