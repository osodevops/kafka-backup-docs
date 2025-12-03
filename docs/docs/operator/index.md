---
title: Operator Overview
description: Kubernetes Operator for OSO Kafka Backup
sidebar_position: 1
---

# Kubernetes Operator

The OSO Kafka Backup Operator provides Kubernetes-native management of Kafka backup and restore operations.

## Overview

The operator extends Kubernetes with Custom Resource Definitions (CRDs) that allow you to:

- Schedule automated backups
- Perform point-in-time restores
- Manage consumer group offsets
- Snapshot and rollback consumer positions

## Custom Resource Definitions

| CRD | Short Name | Description |
|-----|------------|-------------|
| `KafkaBackup` | `kb` | Backup Kafka topics to object storage |
| `KafkaRestore` | `kr` | Restore data from backups |
| `KafkaOffsetReset` | `kor` | Reset consumer group offsets |
| `KafkaOffsetRollback` | `korb` | Snapshot and rollback consumer offsets |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                   Kafka Backup Operator                              │   │
│   │                                                                      │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│   │  │   Backup     │  │   Restore    │  │   Offset     │              │   │
│   │  │  Controller  │  │  Controller  │  │  Controller  │              │   │
│   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │   │
│   │         │                 │                 │                       │   │
│   └─────────┼─────────────────┼─────────────────┼───────────────────────┘   │
│             │                 │                 │                            │
│             ▼                 ▼                 ▼                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Custom Resources                                │   │
│   │                                                                      │   │
│   │   KafkaBackup      KafkaRestore    KafkaOffsetReset                 │   │
│   │   KafkaOffsetRollback                                                │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌──────────────────┐            ┌──────────────────┐                      │
│   │  Kafka Cluster   │            │  Object Storage  │                      │
│   │                  │◀──────────▶│  (S3/Azure/GCS)  │                      │
│   └──────────────────┘            └──────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### Scheduled Backups

Create automated backup schedules using cron expressions:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: hourly-backup
spec:
  schedule: "0 * * * *"  # Every hour
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  topics:
    - orders
    - payments
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
```

### Point-in-Time Recovery

Restore data to any specific moment:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: pitr-restore
spec:
  backupId: "backup-20241201-120000"
  pitr:
    enabled: true
    timestamp: "2024-12-01T12:00:00Z"
```

### Offset Management

Manage consumer group offsets across clusters:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: reset-after-restore
spec:
  strategy: headerBased
  consumerGroups:
    - order-processor
```

### GitOps Integration

All resources are declarative and version-controllable:

```yaml
# backup.yaml - Store in Git
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: production-backup
spec:
  # ...
```

## Quick Start

### 1. Install the Operator

```bash
# Add Helm repository
helm repo add oso https://charts.oso.sh
helm repo update

# Install operator
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --create-namespace
```

### 2. Create a Backup

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: my-first-backup
  namespace: kafka-backup
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka.default.svc:9092
  topics:
    - my-topic
  storage:
    storageType: s3
    s3:
      bucket: my-kafka-backups
      region: us-west-2
```

```bash
kubectl apply -f backup.yaml
```

### 3. Monitor Progress

```bash
kubectl get kafkabackup my-first-backup -o yaml

# Or watch status
kubectl get kafkabackup -w
```

## API Reference

### API Group and Version

- **API Group**: `kafka.oso.sh`
- **API Version**: `v1alpha1`

### Resource Types

| Kind | Description |
|------|-------------|
| `KafkaBackup` | Defines backup configuration and schedule |
| `KafkaRestore` | Defines restore operation |
| `KafkaOffsetReset` | Defines offset reset operation |
| `KafkaOffsetRollback` | Defines offset snapshot/rollback |

## Comparison with CLI

| Feature | CLI | Operator |
|---------|-----|----------|
| Scheduled backups | External scheduler (cron) | Built-in (CronJob) |
| Declarative config | YAML files | Kubernetes CRDs |
| GitOps | Manual | Native |
| Monitoring | Prometheus endpoint | ServiceMonitor |
| HA deployment | Manual | Built-in |
| Secret management | Environment variables | Kubernetes Secrets |

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+ (for installation)
- Access to Kafka cluster
- Access to object storage (S3, Azure, GCS)

## Next Steps

- [Installation](./installation) - Install the operator
- [Configuration](./configuration) - Configure Helm values
- [KafkaBackup CRD](./crds/kafkabackup) - Backup resource reference
- [Scheduled Backups Guide](./guides/scheduled-backups) - Set up automated backups
