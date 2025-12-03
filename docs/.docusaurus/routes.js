import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/',
    component: ComponentCreator('/', 'ee1'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '2f6'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', 'caf'),
            routes: [
              {
                path: '/architecture/compression',
                component: ComponentCreator('/architecture/compression', 'a64'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/architecture/offset-translation',
                component: ComponentCreator('/architecture/offset-translation', 'a9d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/architecture/overview',
                component: ComponentCreator('/architecture/overview', '67c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/architecture/pitr-implementation',
                component: ComponentCreator('/architecture/pitr-implementation', '68f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/architecture/zero-copy-optimization',
                component: ComponentCreator('/architecture/zero-copy-optimization', '80f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/',
                component: ComponentCreator('/deployment/', '703'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/bare-metal',
                component: ComponentCreator('/deployment/bare-metal', '2fb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/cloud-setup/aws-s3',
                component: ComponentCreator('/deployment/cloud-setup/aws-s3', '40d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/cloud-setup/azure-blob',
                component: ComponentCreator('/deployment/cloud-setup/azure-blob', '26a'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/cloud-setup/gcs',
                component: ComponentCreator('/deployment/cloud-setup/gcs', '3be'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/docker',
                component: ComponentCreator('/deployment/docker', '19c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/deployment/kubernetes',
                component: ComponentCreator('/deployment/kubernetes', '6dc'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/enterprise/',
                component: ComponentCreator('/enterprise/', '24c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/enterprise/audit-logging',
                component: ComponentCreator('/enterprise/audit-logging', '025'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/enterprise/encryption',
                component: ComponentCreator('/enterprise/encryption', '10b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/enterprise/licensing',
                component: ComponentCreator('/enterprise/licensing', 'f26'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/enterprise/rbac',
                component: ComponentCreator('/enterprise/rbac', '956'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/enterprise/schema-registry',
                component: ComponentCreator('/enterprise/schema-registry', 'efa'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/examples/aws-lambda',
                component: ComponentCreator('/examples/aws-lambda', '4f3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/examples/kafka-streams',
                component: ComponentCreator('/examples/kafka-streams', '5f8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/examples/multi-cluster-dr',
                component: ComponentCreator('/examples/multi-cluster-dr', 'b1d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/examples/spring-boot',
                component: ComponentCreator('/examples/spring-boot', 'c03'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/getting-started/',
                component: ComponentCreator('/getting-started/', '61c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/getting-started/cli-basics',
                component: ComponentCreator('/getting-started/cli-basics', 'b7e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/getting-started/first-backup',
                component: ComponentCreator('/getting-started/first-backup', '2c7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/getting-started/quickstart',
                component: ComponentCreator('/getting-started/quickstart', 'e41'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/guides/backup-to-s3',
                component: ComponentCreator('/guides/backup-to-s3', 'a02'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/guides/offset-management',
                component: ComponentCreator('/guides/offset-management', '4e0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/guides/performance-tuning',
                component: ComponentCreator('/guides/performance-tuning', '539'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/guides/restore-pitr',
                component: ComponentCreator('/guides/restore-pitr', 'e6c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/guides/security-setup',
                component: ComponentCreator('/guides/security-setup', 'd87'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/',
                component: ComponentCreator('/operator/', '300'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/configuration',
                component: ComponentCreator('/operator/configuration', '4f1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/crds/kafkabackup',
                component: ComponentCreator('/operator/crds/kafkabackup', '432'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/crds/kafkaoffsetreset',
                component: ComponentCreator('/operator/crds/kafkaoffsetreset', '15b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/crds/kafkaoffsetrollback',
                component: ComponentCreator('/operator/crds/kafkaoffsetrollback', '072'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/crds/kafkarestore',
                component: ComponentCreator('/operator/crds/kafkarestore', '564'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/guides/gitops',
                component: ComponentCreator('/operator/guides/gitops', 'a6f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/guides/scheduled-backups',
                component: ComponentCreator('/operator/guides/scheduled-backups', '06d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/guides/secrets',
                component: ComponentCreator('/operator/guides/secrets', '372'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/installation',
                component: ComponentCreator('/operator/installation', '025'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/metrics',
                component: ComponentCreator('/operator/metrics', 'ad1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/operator/troubleshooting',
                component: ComponentCreator('/operator/troubleshooting', '812'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/reference/cli-reference',
                component: ComponentCreator('/reference/cli-reference', '944'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/reference/config-yaml',
                component: ComponentCreator('/reference/config-yaml', '36f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/reference/error-codes',
                component: ComponentCreator('/reference/error-codes', '742'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/reference/metrics',
                component: ComponentCreator('/reference/metrics', 'ffa'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/reference/storage-format',
                component: ComponentCreator('/reference/storage-format', 'b19'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/troubleshooting/common-errors',
                component: ComponentCreator('/troubleshooting/common-errors', '2a1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/troubleshooting/debug-mode',
                component: ComponentCreator('/troubleshooting/debug-mode', 'bd0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/troubleshooting/offset-discontinuity',
                component: ComponentCreator('/troubleshooting/offset-discontinuity', '391'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/troubleshooting/performance-issues',
                component: ComponentCreator('/troubleshooting/performance-issues', '877'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/troubleshooting/support',
                component: ComponentCreator('/troubleshooting/support', '78f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/use-cases/compliance-audit',
                component: ComponentCreator('/use-cases/compliance-audit', '7cb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/use-cases/disaster-recovery',
                component: ComponentCreator('/use-cases/disaster-recovery', '58d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/use-cases/migration',
                component: ComponentCreator('/use-cases/migration', '253'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/use-cases/vs-alternatives',
                component: ComponentCreator('/use-cases/vs-alternatives', 'e88'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/',
                component: ComponentCreator('/', 'b56'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
