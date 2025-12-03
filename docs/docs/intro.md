---
title: OSO Kafka Backup
slug: /
description: High-performance backup and restore for Apache Kafka with point-in-time recovery. Supports S3, Azure Blob, GCS, and local storage. Open source (MIT).
sidebar_position: 1
---

# OSO Kafka Backup Documentation

High-performance backup and restore for Apache Kafka with millisecond-precision point-in-time recovery.

## Choose Your Path

### I'm Evaluating

Learn why OSO Kafka Backup might be right for your organization.

- **[Why OSO Kafka Backup?](./use-cases/disaster-recovery)** - Understand the problems we solve
- **[Feature Comparison](./use-cases/vs-alternatives)** - Compare with MirrorMaker, Confluent Replicator, and other solutions
- **[Enterprise Features](./enterprise)** - Encryption, RBAC, audit logging, and more
- **[Contact Sales](https://www.oso.sh/contact)** - Talk to our team about enterprise licensing

### I'm Getting Started

Get up and running with your first backup in minutes.

- **[5-Minute Quickstart](./getting-started/quickstart)** - Your first backup in 5 minutes
- **[Installation Guide](./deployment)** - Install on bare metal, Docker, or Kubernetes
- **[CLI Basics](./getting-started/cli-basics)** - Learn the command-line interface
- **[First Backup Tutorial](./getting-started/first-backup)** - Step-by-step backup walkthrough

### I'm Operating It

Deploy, configure, and maintain Kafka Backup in production.

- **[Deployment Guide](./deployment)** - Production deployment best practices
- **[Kubernetes Operator](./operator)** - GitOps-native backup management
- **[Configuration Reference](./reference/config-yaml)** - All configuration options
- **[Performance Tuning](./guides/performance-tuning)** - Optimize throughput and resource usage

### I'm Developing With It

Integrate Kafka Backup into your applications and workflows.

- **[CLI Reference](./reference/cli-reference)** - Complete command documentation
- **[Architecture Overview](./architecture/overview)** - Understand how it works
- **[Examples](./examples/kafka-streams)** - Real-world integration examples
- **[Storage Format](./reference/storage-format)** - Backup file structure and format

### I Need Help

Troubleshoot issues and get support.

- **[Troubleshooting Guide](./troubleshooting/common-errors)** - Common errors and solutions
- **[Debug Mode](./troubleshooting/debug-mode)** - Enable verbose logging
- **[GitHub Issues](https://github.com/osodevops/kafka-backup/issues)** - Report bugs and request features
- **[Enterprise Support](https://www.oso.sh/contact)** - Get help from our team

---

## Key Features

### High Performance
Built in Rust for maximum throughput. Achieve **100+ MB/s per partition** with minimal CPU and memory overhead.

### Point-in-Time Recovery
Restore to any millisecond within your backup window. Perfect for disaster recovery, compliance, and debugging production issues.

### Zero Downtime
Back up your Kafka cluster without stopping brokers or consumers. No maintenance windows required.

### Multi-Cloud Storage
Native support for **AWS S3**, **Azure Blob Storage**, **Google Cloud Storage**, and local filesystems. Use any S3-compatible storage like MinIO or Ceph.

### Kubernetes Native
Full Kubernetes operator with CRDs for GitOps workflows. Schedule automated backups with cron expressions.

### Enterprise Ready
Field-level encryption, data masking, RBAC, audit logging, and Schema Registry integration for enterprise deployments.

---

## Quick Example

### Backup a Topic

```bash
# Create a backup configuration
cat > backup.yaml << EOF
mode: backup
backup_id: "my-first-backup"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - orders
      - payments

storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"

backup:
  compression: zstd
EOF

# Run the backup
kafka-backup backup --config backup.yaml
```

### Restore with Point-in-Time Recovery

```bash
# Create a restore configuration with time window
cat > restore.yaml << EOF
mode: restore
backup_id: "my-first-backup"

target:
  bootstrap_servers:
    - kafka-dr:9092

storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"

restore:
  time_window_start: 1701417600000  # Dec 1, 2024 10:00 UTC
  time_window_end: 1701504000000    # Dec 2, 2024 10:00 UTC
EOF

# Run the restore
kafka-backup restore --config restore.yaml
```

---

## What's New

- **v0.2.0** - Kubernetes Operator with CRD support
- **v0.1.0** - Initial release with CLI, S3/Azure/GCS support, PITR

---

## Community

- **GitHub**: [osodevops/kafka-backup](https://github.com/osodevops/kafka-backup)
- **Issues**: [Report bugs](https://github.com/osodevops/kafka-backup/issues)
- **Discussions**: [Ask questions](https://github.com/osodevops/kafka-backup/discussions)

---

## License

OSO Kafka Backup is open source under the [MIT License](https://github.com/osodevops/kafka-backup/blob/main/LICENSE).

Enterprise features require a commercial license. [Contact us](https://www.oso.sh/contact) for pricing.
