---
title: KafkaRestore
description: KafkaRestore Custom Resource Definition reference
sidebar_position: 2
---

# KafkaRestore CRD

The `KafkaRestore` custom resource defines a restore operation from a backup.

## Overview

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: my-restore
  namespace: kafka-backup
spec:
  backupId: "production-backup-20241201-120000"
  # Restore configuration
```

## Full Specification

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: production-restore
  namespace: kafka-backup
spec:
  # Backup to restore from (required)
  backupId: "production-backup-20241201-120000"

  # Target Kafka cluster
  targetCluster:
    bootstrapServers:
      - kafka-0.kafka.svc:9092
      - kafka-1.kafka.svc:9092
      - kafka-2.kafka.svc:9092
    securityProtocol: SASL_SSL
    tlsSecret:
      name: kafka-tls
      caKey: ca.crt
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
      usernameKey: username
      passwordKey: password

  # Storage configuration (where backup is stored)
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: production/hourly
      credentialsSecret:
        name: s3-credentials
        accessKeyKey: accessKey
        secretKeyKey: secretKey

  # Topics to restore (optional - defaults to all)
  topics:
    - orders
    - payments

  # Topic mapping (rename during restore)
  topicMapping:
    orders: restored-orders
    payments: restored-payments

  # Auto-create topics (v0.3.0+)
  createTopics: true
  defaultReplicationFactor: 3

  # Point-in-time recovery
  pitr:
    enabled: true
    # Either timestamp or milliseconds
    timestamp: "2024-12-01T12:00:00Z"
    # Or: timestampMillis: 1701432000000

  # Include original offset headers
  includeOriginalOffsetHeader: true

  # Offset reset configuration
  offsetReset:
    enabled: true
    strategy: headerBased  # earliest, latest, timestamp, offset, headerBased
    sourceCluster: "production-us-west-2"
    consumerGroups:
      - order-processor
      - payment-handler
    # For timestamp strategy
    timestamp: "2024-12-01T12:00:00Z"

  # Rollback configuration (create snapshot before restore)
  rollback:
    enabled: true
    snapshotId: "pre-restore-snapshot"

  # Resource requirements for restore job
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2
      memory: 2Gi

  # Job configuration
  job:
    backoffLimit: 3
    activeDeadlineSeconds: 7200
    ttlSecondsAfterFinished: 86400

  # Pod configuration
  podTemplate:
    annotations: {}
    labels: {}
    nodeSelector: {}
    tolerations: []
```

## Spec Fields

### backupId

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `backupId` | string | Yes | ID of the backup to restore |

### targetCluster

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bootstrapServers` | []string | Yes | Target Kafka broker addresses |
| `securityProtocol` | string | No | Security protocol |
| `tlsSecret` | object | No | TLS certificate secret |
| `saslSecret` | object | No | SASL credentials secret |

### pitr

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | bool | No | Enable point-in-time recovery |
| `timestamp` | string | No | ISO 8601 timestamp |
| `timestampMillis` | int | No | Unix timestamp in milliseconds |

### topicMapping

Map source topics to different target topic names:

```yaml
topicMapping:
  source-topic-1: target-topic-1
  source-topic-2: target-topic-2
```

### createTopics

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `createTopics` | bool | No | Auto-create topics if they don't exist (v0.3.0+) |
| `defaultReplicationFactor` | int | No | Replication factor for auto-created topics |

:::tip
When using `topicMapping` to restore to new topic names, enable `createTopics: true` to automatically create the target topics. This prevents "Partition not available" errors that can occur when producing to non-existent topics.
:::

### offsetReset

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | bool | No | Enable offset reset after restore |
| `strategy` | string | Yes | Reset strategy |
| `sourceCluster` | string | No | Source cluster ID (for headerBased) |
| `consumerGroups` | []string | Yes | Groups to reset |
| `timestamp` | string | No | Timestamp (for timestamp strategy) |

### rollback

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | bool | No | Create snapshot before restore |
| `snapshotId` | string | No | ID for the snapshot |

## Status

```yaml
status:
  phase: Completed  # Pending, Running, Completed, Failed
  startTime: "2024-12-01T12:00:00Z"
  completionTime: "2024-12-01T12:30:00Z"
  restoredRecords: 1000000
  restoredTopics:
    - name: orders
      records: 500000
    - name: payments
      records: 500000
  offsetResetStatus:
    phase: Completed
    groupsReset:
      - order-processor
      - payment-handler
  rollbackSnapshotId: "pre-restore-snapshot"
  conditions:
    - type: Ready
      status: "True"
      reason: RestoreCompleted
      message: "Restore completed successfully"
      lastTransitionTime: "2024-12-01T12:30:00Z"
```

## Examples

### Simple Restore

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: simple-restore
spec:
  backupId: "backup-20241201"

  targetCluster:
    bootstrapServers:
      - kafka:9092

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
```

### PITR Restore

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: pitr-restore
spec:
  backupId: "production-backup-20241201"

  targetCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: production

  pitr:
    enabled: true
    timestamp: "2024-12-01T10:30:00Z"  # Before the incident

  includeOriginalOffsetHeader: true
```

### Restore with Offset Reset

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: full-restore
spec:
  backupId: "production-backup-20241201"

  targetCluster:
    bootstrapServers:
      - dr-kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-east-1

  includeOriginalOffsetHeader: true

  offsetReset:
    enabled: true
    strategy: headerBased
    sourceCluster: "production-us-west-2"
    consumerGroups:
      - order-processor
      - payment-handler
      - notification-service

  rollback:
    enabled: true
    snapshotId: "pre-restore-20241201"
```

### Restore with Topic Remapping

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: dev-restore
spec:
  backupId: "production-backup-20241201"

  targetCluster:
    bootstrapServers:
      - dev-kafka:9092

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2

  topics:
    - orders
    - payments

  topicMapping:
    orders: dev-orders
    payments: dev-payments

  # Auto-create the remapped topics (v0.3.0+)
  createTopics: true
  defaultReplicationFactor: 1  # Lower for dev environment
```

### Cross-Region Restore

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: dr-restore
spec:
  backupId: "us-west-2-backup-20241201"

  targetCluster:
    bootstrapServers:
      - kafka.us-east-1.example.com:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: dr-kafka-credentials
      mechanism: SCRAM-SHA-256

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups-dr  # Cross-region replicated bucket
      region: us-east-1
      prefix: us-west-2

  includeOriginalOffsetHeader: true

  offsetReset:
    enabled: true
    strategy: headerBased
    sourceCluster: "production-us-west-2"
    consumerGroups:
      - order-processor
      - payment-handler
```

## Operations

### Check Restore Status

```bash
kubectl get kafkarestore my-restore -o jsonpath='{.status.phase}'
```

### View Restore Progress

```bash
kubectl get kafkarestore my-restore -o yaml | grep -A 20 status
```

### Cancel Restore

```bash
# Delete the restore resource
kubectl delete kafkarestore my-restore

# This will terminate the running job
```

### Rollback After Restore

If restore caused issues and rollback snapshot was created:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: rollback-restore
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  operation: rollback
  snapshotId: "pre-restore-20241201"
  consumerGroups:
    - order-processor
```

## Offset Reset Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `earliest` | Reset to beginning | Reprocess all data |
| `latest` | Reset to end | Skip to current |
| `timestamp` | Reset to timestamp | Resume from time |
| `offset` | Reset to specific offset | Precise control |
| `headerBased` | Use backup offset headers | Continue exactly |

## Next Steps

- [KafkaOffsetReset](./kafkaoffsetreset) - Standalone offset reset
- [KafkaOffsetRollback](./kafkaoffsetrollback) - Snapshot and rollback
- [PITR Guide](../../guides/restore-pitr) - Point-in-time recovery
