import config from './docusaurus.config.js';

const siteUrl = config.url + config.baseUrl.replace(/\/$/, '');

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/index',
        'getting-started/quickstart',
        'getting-started/cli-basics',
        'getting-started/first-backup',
      ],
    },
    {
      type: 'category',
      label: 'Use Cases',
      items: [
        'use-cases/disaster-recovery',
        'use-cases/compliance-audit',
        'use-cases/migration',
        'use-cases/vs-alternatives',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/index',
        'deployment/bare-metal',
        'deployment/docker',
        'deployment/kubernetes',
        {
          type: 'category',
          label: 'Cloud Setup',
          items: [
            'deployment/cloud-setup/aws-s3',
            'deployment/cloud-setup/azure-blob',
            'deployment/cloud-setup/gcs',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/backup-to-s3',
        'guides/restore-pitr',
        'guides/offset-management',
        'guides/performance-tuning',
        'guides/security-setup',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/cli-reference',
        'reference/config-yaml',
        'reference/storage-format',
        'reference/error-codes',
        'reference/metrics',
      ],
    },
    {
      type: 'category',
      label: 'Kubernetes Operator',
      items: [
        'operator/index',
        'operator/installation',
        'operator/configuration',
        {
          type: 'category',
          label: 'CRD Reference',
          items: [
            'operator/crds/kafkabackup',
            'operator/crds/kafkarestore',
            'operator/crds/kafkaoffsetreset',
            'operator/crds/kafkaoffsetrollback',
          ],
        },
        {
          type: 'category',
          label: 'Operator Guides',
          items: [
            'operator/guides/scheduled-backups',
            'operator/guides/gitops',
            'operator/guides/secrets',
          ],
        },
        'operator/metrics',
        'operator/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Enterprise',
      items: [
        'enterprise/index',
        'enterprise/encryption',
        'enterprise/rbac',
        'enterprise/audit-logging',
        'enterprise/schema-registry',
        'enterprise/licensing',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/offset-translation',
        'architecture/pitr-implementation',
        'architecture/compression',
        'architecture/zero-copy-optimization',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-errors',
        'troubleshooting/performance-issues',
        'troubleshooting/offset-discontinuity',
        'troubleshooting/debug-mode',
        'troubleshooting/support',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/kafka-streams',
        'examples/spring-boot',
        'examples/aws-lambda',
        'examples/multi-cluster-dr',
      ],
    },
    {
      type: 'category',
      label: 'LLM Resources',
      collapsed: false,
      items: [
        {
          type: 'link',
          label: 'llms.txt',
          href: `${siteUrl}/llms.txt`,
        },
        {
          type: 'link',
          label: 'markdown.zip',
          href: `${siteUrl}/markdown.zip`,
        },
      ],
    },
  ],
};

export default sidebars;
