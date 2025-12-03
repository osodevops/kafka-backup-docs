# OSO Kafka Backup: Enterprise Documentation & GitHub Repository PRD

**Date:** 2025-12-02  
**Scope:** Complete documentation site and repository structure (modeled on Conduktor)  
**Target:** Production-ready, SEO-optimized, developer-centric documentation  

---

## Executive Summary

Conduktor's documentation (docs.conduktor.io) succeeds because it:

1. **Separates concerns:** Different user types → different entry points
2. **Progressive disclosure:** "Use cases" → "Deploy" → "Configure" → "API Reference"
3. **Docusaurus-based:** Built on Docusaurus (SSG), fast, SEO-friendly, versioned
4. **Clear IA:** Information architecture follows user intent, not feature lists
5. **Multi-tier nav:** Guides → References → APIs → Runbooks → Troubleshooting

This PRD replicates that structure for OSO Kafka Backup across two repos:
- **kafka-backup** (GitHub docs + website marketing)
- **kafka-backup-operator** (Kubernetes-specific docs)

---

## Part 1: Information Architecture Framework

### IA Principles (Conduktor Model)

Conduktor organizes documentation into **5 Intent-Based Tiers:**

| Tier | Purpose | Users | Example |
|------|---------|-------|---------|
| **Use Cases** | "Why should I care?" | Evaluators, Decision makers | "Disaster Recovery Scenarios", "Compliance Requirements" |
| **Deployment** | "How do I install it?" | Operators, SREs | "Installation Guide", "Kubernetes Deployment" |
| **Configuration** | "How do I tune it?" | Engineers, DevOps | "Configuration Reference", "Performance Tuning" |
| **API Reference** | "How do I use it?" | Developers | "Backup API", "Restore API", "CLI Reference" |
| **Troubleshooting** | "How do I fix it?" | Support, On-call | "Common Errors", "Debug Guide", "Performance Issues" |

### For OSO Kafka Backup

Map to **3 Main Entry Points** (matching user roles):

1. **For Evaluators/Buyers** → "Use Cases" + "Why OSO Backup"
2. **For Operators/SREs** → "Installation" + "Deployment" + "Operations"
3. **For Developers/Users** → "Getting Started" + "API Reference" + "Examples"

---

## Part 2: Repository Structure (kafka-backup-docs)

### GitHub Repository Layout

```
kafka-backup-docs/
├── README.md                           # Link to docs.oso.sh
├── CONTRIBUTING.md                     # Development guidelines
├── docs/                               # All documentation content
│   ├── docs/
│   │   ├── intro.md                    # "Why OSO Kafka Backup?"
│   │   ├── getting-started/            # 5-min quickstart
│   │   │   ├── index.md
│   │   │   ├── quickstart.md
│   │   │   ├── cli-basics.md
│   │   │   └── first-backup.md
│   │   ├── use-cases/                  # "When would I use this?"
│   │   │   ├── disaster-recovery.md
│   │   │   ├── compliance-audit.md
│   │   │   ├── migration.md
│   │   │   └── vs-alternatives.md
│   │   ├── deployment/                 # Installation & operations
│   │   │   ├── index.md
│   │   │   ├── bare-metal.md
│   │   │   ├── docker.md
│   │   │   ├── kubernetes.md           # K8s native deployment (no operator)
│   │   │   └── cloud-setup/
│   │   │       ├── aws-s3.md
│   │   │       ├── azure-blob.md
│   │   │       └── gcs.md
│   │   ├── guides/                     # Step-by-step procedures
│   │   │   ├── backup-to-s3.md
│   │   │   ├── restore-pitr.md
│   │   │   ├── offset-management.md
│   │   │   ├── performance-tuning.md
│   │   │   └── security-setup.md
│   │   ├── reference/                  # API & config reference
│   │   │   ├── cli-reference.md        # Every CLI command
│   │   │   ├── config-yaml.md          # Config file spec
│   │   │   ├── storage-format.md       # S3 backup layout
│   │   │   ├── error-codes.md
│   │   │   └── metrics.md
│   │   ├── enterprise/                 # Enterprise-only features
│   │   │   ├── index.md
│   │   │   ├── encryption.md
│   │   │   ├── rbac.md
│   │   │   ├── audit-logging.md
│   │   │   ├── schema-registry.md
│   │   │   └── licensing.md
│   │   ├── troubleshooting/            # Runbooks & debugging
│   │   │   ├── common-errors.md
│   │   │   ├── performance-issues.md
│   │   │   ├── offset-discontinuity.md
│   │   │   ├── debug-mode.md
│   │   │   └── support.md
│   │   ├── architecture/               # Technical deep-dives
│   │   │   ├── overview.md
│   │   │   ├── offset-translation.md
│   │   │   ├── pitr-implementation.md
│   │   │   ├── compression.md
│   │   │   └── zero-copy-optimization.md
│   │   └── examples/                   # Real-world scenarios
│   │       ├── kafka-streams.md
│   │       ├── spring-boot.md
│   │       ├── aws-lambda.md
│   │       └── multi-cluster-dr.md
│   ├── blog/                           # Blog posts (optional)
│   │   └── *.md
│   ├── static/                         # Images, diagrams
│   │   ├── architecture/
│   │   │   ├── system-architecture.svg
│   │   │   ├── replication-vs-backup.svg
│   │   │   └── pitr-timeline.svg
│   │   ├── screenshots/
│   │   └── diagrams/
│   ├── sidebars.js                     # Docusaurus sidebar config
│   ├── docusaurus.config.js            # Docusaurus main config
│   ├── package.json
│   └── README.md                       # "How to run docs locally"
├── .github/
│   └── workflows/
│       ├── docs-deploy.yml             # Deploy to docs.oso.sh
│       └── docs-validate.yml           # Check broken links
└── tests/
    └── docs/                           # Test CLI examples in docs
```

### GitHub ROOT README.md

Link strategy (not full docs):

```markdown
# OSO Kafka Backup

High-performance Kafka backup and restore with point-in-time recovery.

## Quick Links

- **📖 Full Documentation:** [docs.oso.sh](https://docs.oso.sh)
- **🚀 Getting Started:** [5-minute quickstart](https://docs.oso.sh/getting-started/quickstart)
- **🎯 Use Cases:** [When to use Kafka Backup](https://docs.oso.sh/use-cases)
- **🔧 API Reference:** [CLI & Config Reference](https://docs.oso.sh/reference)
- **⚙️ Deployment:** [Install on K8s, Docker, Bare Metal](https://docs.oso.sh/deployment)

## Features

[Brief bullet list, no walls of text]

## Installation

[Link to docs.oso.sh, not full instructions]

## License

MIT
```

---

## Part 3: Docusaurus Configuration

### docusaurus.config.js

```javascript
// @ts-check
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'OSO Kafka Backup',
  tagline: 'High-performance backup and restore for Apache Kafka',
  favicon: 'img/favicon.ico',
  url: 'https://docs.oso.sh',
  baseUrl: '/',
  
  onBrokenLinks: 'throw',  // Fail on broken links in CI
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
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/osodevops/kafka-backup/tree/main/docs/',
          // Versioning: release v1.0 → creates /docs/1.0/
          lastVersion: undefined,
          versions: {
            current: {
              label: 'Unreleased',
              path: 'next',
            },
          },
        },
        blog: false,  // No blog
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'OSO Kafka Backup',
      logo: {
        alt: 'OSO DevOps Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          label: 'Docs',
        },
        {
          href: 'https://github.com/osodevops/kafka-backup',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.oso.sh',
          label: 'OSO DevOps',
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
            { label: 'Getting Started', to: '/docs/getting-started' },
            { label: 'Deployment', to: '/docs/deployment' },
            { label: 'API Reference', to: '/docs/reference' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/osodevops/kafka-backup' },
            { label: 'Issues', href: 'https://github.com/osodevops/kafka-backup/issues' },
            { label: 'Discussions', href: 'https://github.com/osodevops/kafka-backup/discussions' },
          ],
        },
        {
          title: 'Enterprise',
          items: [
            { label: 'Contact Sales', href: 'https://www.oso.sh/contact' },
            { label: 'Enterprise Docs', to: '/docs/enterprise' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} OSO DevOps. Built with Docusaurus.`,
    },
    
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
      additionalLanguages: ['bash', 'yaml', 'json', 'rust'],
    },
  },
};

module.exports = config;
```

### sidebars.js

```javascript
module.exports = {
  tutorialSidebar: [
    'intro',
    {
      label: '🚀 Getting Started',
      items: [
        'getting-started/index',
        'getting-started/quickstart',
        'getting-started/cli-basics',
        'getting-started/first-backup',
      ],
    },
    {
      label: '💡 Use Cases',
      items: [
        'use-cases/index',
        'use-cases/disaster-recovery',
        'use-cases/compliance-audit',
        'use-cases/migration',
        'use-cases/vs-alternatives',
      ],
    },
    {
      label: '⚙️ Deployment',
      items: [
        'deployment/index',
        'deployment/bare-metal',
        'deployment/docker',
        'deployment/kubernetes',
        {
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
      label: '📖 Guides',
      items: [
        'guides/backup-to-s3',
        'guides/restore-pitr',
        'guides/offset-management',
        'guides/performance-tuning',
        'guides/security-setup',
      ],
    },
    {
      label: '🔧 Reference',
      items: [
        'reference/cli-reference',
        'reference/config-yaml',
        'reference/storage-format',
        'reference/error-codes',
        'reference/metrics',
      ],
    },
    {
      label: '🔐 Enterprise',
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
      label: '🏗️ Architecture',
      items: [
        'architecture/overview',
        'architecture/offset-translation',
        'architecture/pitr-implementation',
        'architecture/compression',
        'architecture/zero-copy-optimization',
      ],
    },
    {
      label: '🔍 Troubleshooting',
      items: [
        'troubleshooting/common-errors',
        'troubleshooting/performance-issues',
        'troubleshooting/offset-discontinuity',
        'troubleshooting/debug-mode',
        'troubleshooting/support',
      ],
    },
    {
      label: '📚 Examples',
      items: [
        'examples/kafka-streams',
        'examples/spring-boot',
        'examples/aws-lambda',
        'examples/multi-cluster-dr',
      ],
    },
  ],
};
```

---

## Part 4: Documentation Content Strategy

### Page Templates (Following Conduktor)

#### Type 1: Use Case Page

**File:** `docs/use-cases/disaster-recovery.md`

```markdown
---
title: Disaster Recovery
description: Use Kafka Backup for zero-downtime disaster recovery
---

# Disaster Recovery with OSO Kafka Backup

## The Problem

[Problem statement: Why MirrorMaker isn't enough]

## The Scenario

[Real-world example: Regional failure, topic deletion, etc.]

## Architecture Diagram

[SVG diagram showing Prod → Backup → DR Cluster]

## Step-by-Step Walkthrough

1. Setup
2. Backup
3. Disaster occurs
4. Restore
5. Verification

## RTO/RPO Metrics

[Table showing recovery time/data loss]

## Cost Comparison

[Passive DR vs. Active-Active vs. Tiered Storage]

## See Also

- [PITR Implementation](../architecture/pitr-implementation.md)
- [Deployment Guide](../deployment/index.md)
```

#### Type 2: Guide Page (Procedural)

**File:** `docs/guides/restore-pitr.md`

```markdown
---
title: Point-in-Time Restore (PITR)
---

# Restoring to a Specific Point in Time

## Overview

[Explain what PITR does and why it's powerful]

## Prerequisites

- [ ] OSO Kafka Backup installed
- [ ] S3 bucket with existing backups
- [ ] Target Kafka cluster

## Step 1: List Available Backups

\`\`\`bash
kafka-backup list --path s3://my-bucket/backups
\`\`\`

## Step 2: Create Restore Configuration

\`\`\`yaml
mode: restore
backup_id: "daily-backup-001"
target:
  bootstrap_servers: ["kafka-dr:9092"]
restore:
  time_window_start: 1735689600000  # Unix millis
  time_window_end: 1735776000000
\`\`\`

## Step 3: Execute Restore

\`\`\`bash
kafka-backup restore --config restore.yaml
\`\`\`

## Verification

[How to verify the restore succeeded]

## Troubleshooting

[Link to troubleshooting guide]
```

#### Type 3: Reference Page (Lookup)

**File:** `docs/reference/cli-reference.md`

```markdown
---
title: CLI Reference
---

# CLI Commands

## backup

\`\`\`
kafka-backup backup --config <file>
\`\`\`

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--config` | string | required | Path to backup config YAML |
| `--dry-run` | bool | false | Validate config without backup |
| `--parallelism` | int | 4 | Concurrent partitions |

### Example

\`\`\`bash
kafka-backup backup --config backup.yaml --parallelism 8
\`\`\`

## restore

[Similar structured reference]

## [Other commands...]
```

---

## Part 5: Kubernetes Operator Documentation

### kafka-backup-operator Repository

```
kafka-backup-operator/
├── docs/
│   ├── docs/
│   │   ├── intro.md
│   │   ├── getting-started/
│   │   │   ├── quickstart.md
│   │   │   └── first-crd.md
│   │   ├── deployment/
│   │   │   ├── index.md
│   │   │   ├── helm-install.md
│   │   │   └── configuration.md
│   │   ├── crds/                      # CRD reference
│   │   │   ├── kafkabackup.md
│   │   │   ├── kafkarestore.md
│   │   │   └── kafkaoffsetreset.md
│   │   ├── guides/
│   │   │   ├── scheduled-backups.md
│   │   │   ├── disaster-recovery.md
│   │   │   ├── gitops.md
│   │   │   └── monitoring.md
│   │   ├── troubleshooting/
│   │   │   ├── reconciler-errors.md
│   │   │   └── logs.md
│   │   └── architecture.md
│   ├── sidebars.js
│   └── docusaurus.config.js
├── deploy/
│   ├── helm/
│   │   ├── Chart.yaml
│   │   └── values.yaml
│   ├── crds/
│   │   ├── kafkabackup_crd.yaml
│   │   ├── kafkarestore_crd.yaml
│   │   └── kafkaoffsetreset_crd.yaml
│   └── rbac/
│       ├── role.yaml
│       └── rolebinding.yaml
└── README.md
```

---

## Part 6: CI/CD for Documentation

### GitHub Workflow: Deploy Docs

**File:** `.github/workflows/docs-deploy.yml`

```yaml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'docusaurus.config.js'
      - 'sidebars.js'
  pull_request:
    paths:
      - 'docs/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - run: npm ci
      
      - run: npm run build
      
      - run: npm run docusaurus -- deploy --skip-git

  link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - run: npm ci
      
      - run: npm run build
      
      - uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          use-quiet-mode: 'yes'
          use-verbose-mode: 'yes'
```

### Local Development

**File:** `docs/README.md`

```markdown
# Documentation Setup

## Prerequisites

- Node.js 18+
- npm or yarn

## Local Development

\`\`\`bash
cd docs
npm install
npm run start
\`\`\`

Site runs at http://localhost:3000

## Building

\`\`\`bash
npm run build
\`\`\`

Output in `build/` directory.

## Adding a New Document

1. Create `.md` file in appropriate folder
2. Add frontmatter:
   \`\`\`yaml
   ---
   title: "Page Title"
   description: "Short description for SEO"
   ---
   \`\`\`
3. Update `sidebars.js` to add link
4. Run `npm run start` to verify

## Docusaurus Guide

Full docs: https://docusaurus.io/docs
```

---

## Part 7: SEO & Performance

### docusaurus.config.js (Extended)

```javascript
presets: [
  [
    'classic',
    {
      docs: {
        // Versioning strategy
        versions: {
          current: { label: '0.2.x (Latest)', path: '/' },
          '0.1': { label: '0.1.x', path: '/docs/0.1' },
        },
      },
    },
  ],
],

plugins: [
  // Sitemap for search engines
  [
    '@docusaurus/plugin-sitemap',
    { changefreq: 'weekly', priority: 0.5 },
  ],
],

themeConfig: {
  // Meta tags for SEO
  metaTags: [
    { name: 'twitter:card', content: 'summary_large_image' },
    { property: 'og:type', content: 'website' },
  ],
  
  // Analytics
  googleAnalytics: {
    trackingID: 'UA-XXXXXXXXX-X',
    anonymizeIP: true,
  },
  
  // Algolia search (optional, requires setup)
  algolia: {
    appId: 'YOUR_APP_ID',
    apiKey: 'YOUR_SEARCH_KEY',
    indexName: 'kafka_backup',
  },
},
```

---

## Part 8: Multi-Version Strategy

### Release → Documentation Version

When you release `v0.2.0`:

1. **Current branch** (`main`) stays "Unreleased" (labeled `next`)
2. **Tag `v0.2.0`** gets its own documentation version
3. **Users can switch** between versions in docs UI

**File:** `.github/workflows/docs-version.yml`

```yaml
name: Version Documentation

on:
  push:
    tags:
      - 'v*'

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - run: npm ci
      
      - name: Create version
        run: npm run docusaurus -- docs:version ${GITHUB_REF#refs/tags/}
      
      - name: Build
        run: npm run build
      
      - name: Deploy to docs.oso.sh
        run: npm run docusaurus -- deploy
```

---

## Part 9: Writing Guidelines

### Documentation Style Guide

**File:** `docs/STYLE_GUIDE.md`

```markdown
# Documentation Style Guide

## Tone

- **Technical but accessible.** Explain concepts; don't assume knowledge.
- **Action-oriented.** Use verbs: "Create", "Deploy", "Configure", not "It is possible to..."
- **Consistent.** Same term = same concept always.

## Structure

1. **Page title** (H1): Clear, searchable
2. **Overview** (100 words): What this page covers and why
3. **Prerequisites** (if applicable): What user needs first
4. **Steps** (numbered): One action per step
5. **Examples** (code blocks): Copy-paste ready
6. **Troubleshooting** (if applicable): Common errors
7. **See Also** (links): Related pages

## Code Examples

- Always provide copy-paste ready examples.
- Use \`\`\`bash, \`\`\`yaml, \`\`\`json, \`\`\`rust (with language tag)
- Include both command AND expected output where helpful.

## Terminology

| Use | Don't Use |
|-----|-----------|
| "Kafka Backup" | "kafka-backup" (unless referring to CLI) |
| "Point-in-time recovery (PITR)" | "PITR" (spell out first usage) |
| "S3 bucket" | "S3 location" |

## Internal Links

Use relative markdown links:
\`\`\`
[Deployment Guide](../deployment/index.md)
\`\`\`

Not:
\`\`\`
[Deployment Guide](/docs/deployment)
\`\`\`
```

---

## Part 10: Content Calendar

### Q1 2025 Documentation Release Plan

| Week | Content | Status |
|------|---------|--------|
| 1-2 | Getting Started + Use Cases | ⚠️ In Progress |
| 3-4 | Deployment (Bare Metal, Docker, K8s) | 📋 Planned |
| 5-6 | Guides (Backup, Restore, PITR) | 📋 Planned |
| 7-8 | API Reference + CLI Reference | 📋 Planned |
| 9-10 | Architecture + Technical Deep-Dives | 📋 Planned |
| 11-12 | Enterprise Features + Troubleshooting | 📋 Planned |
| 13 | Blog post + SEO optimization | 📋 Planned |

---

## Part 11: Handoff Checklist

### Before Launch (docs.oso.sh)

- [ ] All 50+ pages written and reviewed
- [ ] All code examples tested (run through CI)
- [ ] All links working (link checker CI pass)
- [ ] SEO tags on every page (title, description, OG images)
- [ ] Docusaurus builds locally and in CI
- [ ] Search index created (Algolia or built-in)
- [ ] Mobile responsive (tested on phone/tablet)
- [ ] Accessibility (alt text on images, semantic HTML)
- [ ] Analytics hooked up (Google Analytics)
- [ ] DNS pointed to docs.oso.sh
- [ ] Deployed to production hosting (Vercel, Netlify, or custom)

### Ongoing Maintenance

- [ ] Review broken links monthly
- [ ] Update docs on every release
- [ ] Monitor user feedback (GitHub Issues, email)
- [ ] A/B test navigation structure
- [ ] Track which pages get most traffic (Google Analytics)

---

## Part 12: Deployment Options

### Option 1: Vercel (Recommended)

**Why:** Automatic deployments, free tier available, built for Docusaurus

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd docs
vercel --prod
```

### Option 2: Netlify

**File:** `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option 3: Custom (AWS S3 + CloudFront)

```bash
npm run build
aws s3 sync build/ s3://docs-bucket/ --delete
# CloudFront invalidation...
```

---

## Part 13: Example: Homepage Structure

### docs/intro.md

```markdown
---
title: OSO Kafka Backup Documentation
slug: /
description: >
  High-performance backup and restore for Apache Kafka with point-in-time recovery.
  Supports S3, Azure, GCS. Open source (MIT).
---

# OSO Kafka Backup Documentation

## Choose Your Path

### 👤 I'm an Evaluator
- [Why OSO Backup?](./use-cases/index.md)
- [Feature Comparison](./use-cases/vs-alternatives.md)
- [Pricing & Enterprise](https://www.oso.sh)

### 🚀 I'm Getting Started
- [5-minute Quickstart](./getting-started/quickstart.md)
- [Installation](./deployment/index.md)
- [First Backup](./getting-started/first-backup.md)

### ⚙️ I'm Operating It
- [Deployment Guide](./deployment/index.md)
- [Configuration Reference](./reference/config-yaml.md)
- [Performance Tuning](./guides/performance-tuning.md)

### 🔧 I'm Developing With It
- [API Reference](./reference/cli-reference.md)
- [Architecture](./architecture/index.md)
- [Examples](./examples/index.md)

### 🆘 I Need Help
- [Troubleshooting](./troubleshooting/index.md)
- [GitHub Issues](https://github.com/osodevops/kafka-backup/issues)
- [Enterprise Support](https://www.oso.sh/contact)

---

## Key Features

**High Performance:** 100+ MB/s throughput per partition  
**Point-in-Time Recovery:** Millisecond precision restore  
**Zero Downtime:** No need to stop brokers or consumers  
**Cloud Native:** S3, Azure, GCS support out of the box  
**Open Source:** MIT license, fully auditable
```

---

## Conclusion: Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Docusaurus project structure
- [ ] Create 50+ markdown files (skeleton)
- [ ] Configure sidebars and routing

### Phase 2: Content (Week 3-6)
- [ ] Write all documentation pages
- [ ] Create diagrams and screenshots
- [ ] Add code examples

### Phase 3: Testing & SEO (Week 7-8)
- [ ] Link checker CI
- [ ] Mobile/accessibility testing
- [ ] SEO optimization (titles, descriptions)
- [ ] Analytics setup

### Phase 4: Launch (Week 9)
- [ ] Deploy to docs.oso.sh
- [ ] Announce (Reddit, Twitter, Hacker News)
- [ ] Monitor traffic and feedback

**Total: ~2 months to launch docs.oso.sh**

This structure matches Conduktor's success because it:
✅ Separates user intents (Use Case → Deploy → Reference)  
✅ Provides multiple entry points (Evaluators, Operators, Developers)  
✅ Uses progressive disclosure (Overview → Steps → Reference)  
✅ Is SEO-optimized (titles, descriptions, internal links)  
✅ Scales with versioning (v0.1, v0.2, v1.0)
