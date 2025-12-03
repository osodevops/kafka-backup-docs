---
title: KafkaOffsetRollback
description: KafkaOffsetRollback Custom Resource Definition reference
sidebar_position: 4
---

# KafkaOffsetRollback CRD

The `KafkaOffsetRollback` custom resource manages consumer offset snapshots and rollbacks.

## Overview

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: my-rollback
  namespace: kafka-backup
spec:
  operation: snapshot  # snapshot, rollback, verify, delete
  # Operation configuration
```

## Full Specification

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: offset-rollback
  namespace: kafka-backup
spec:
  # Kafka cluster
  kafkaCluster:
    bootstrapServers:
      - kafka-0.kafka.svc:9092
      - kafka-1.kafka.svc:9092
    securityProtocol: SASL_SSL
    tlsSecret:
      name: kafka-tls
      caKey: ca.crt
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
      usernameKey: username
      passwordKey: password

  # Consumer groups
  consumerGroups:
    - order-processor
    - payment-handler

  # Operation to perform
  operation: snapshot  # snapshot, rollback, verify, delete

  # Snapshot ID (required for all operations)
  snapshotId: "pre-migration-snapshot"

  # Storage for snapshot data
  storage:
    storageType: s3  # s3, azure, gcs, pvc, configmap
    s3:
      bucket: kafka-offset-snapshots
      region: us-west-2
      prefix: snapshots
    # Or use ConfigMap for small snapshots
    configMap:
      name: offset-snapshots

  # Verification options (for verify operation)
  verify:
    strict: true  # Fail if offsets don't match exactly

  # Resource requirements
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi

  # Job configuration
  job:
    backoffLimit: 3
    activeDeadlineSeconds: 600
    ttlSecondsAfterFinished: 3600
```

## Operations

### snapshot

Create a snapshot of current consumer group offsets:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: create-snapshot
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  consumerGroups:
    - order-processor
    - payment-handler
  operation: snapshot
  snapshotId: "pre-migration-20241201"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
```

### rollback

Restore offsets from a snapshot:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: do-rollback
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  consumerGroups:
    - order-processor
    - payment-handler
  operation: rollback
  snapshotId: "pre-migration-20241201"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
```

### verify

Verify current offsets match a snapshot:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: verify-offsets
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  consumerGroups:
    - order-processor
  operation: verify
  snapshotId: "pre-migration-20241201"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
  verify:
    strict: true
```

### delete

Delete a snapshot:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: delete-snapshot
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  operation: delete
  snapshotId: "pre-migration-20241201"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
```

## Spec Fields

### operation

| Value | Description |
|-------|-------------|
| `snapshot` | Create snapshot of current offsets |
| `rollback` | Restore offsets from snapshot |
| `verify` | Compare current offsets to snapshot |
| `delete` | Delete a snapshot |

### storage

| Type | Description | Use Case |
|------|-------------|----------|
| `configMap` | Store in Kubernetes ConfigMap | Small snapshots |
| `s3` | Store in S3 | Large/many groups |
| `azure` | Store in Azure Blob | Azure environments |
| `gcs` | Store in GCS | GCP environments |
| `pvc` | Store in PVC | Local storage |

## Status

```yaml
status:
  phase: Completed  # Pending, Running, Completed, Failed
  operation: snapshot
  snapshotId: "pre-migration-20241201"
  startTime: "2024-12-01T12:00:00Z"
  completionTime: "2024-12-01T12:00:05Z"
  snapshotData:
    groups: 2
    totalPartitions: 12
    timestamp: "2024-12-01T12:00:00Z"
  # For verify operation
  verificationResult:
    matched: true
    differences: []
  conditions:
    - type: Ready
      status: "True"
      reason: SnapshotCreated
      message: "Snapshot pre-migration-20241201 created successfully"
      lastTransitionTime: "2024-12-01T12:00:05Z"
```

## Snapshot Format

Snapshots are stored as JSON:

```json
{
  "snapshotId": "pre-migration-20241201",
  "timestamp": "2024-12-01T12:00:00Z",
  "cluster": "kafka:9092",
  "groups": {
    "order-processor": {
      "topics": {
        "orders": {
          "0": {
            "offset": 1000,
            "metadata": "",
            "timestamp": 1701432000000
          },
          "1": {
            "offset": 2000,
            "metadata": "",
            "timestamp": 1701432000000
          }
        },
        "payments": {
          "0": {
            "offset": 500,
            "metadata": "",
            "timestamp": 1701432000000
          }
        }
      }
    },
    "payment-handler": {
      "topics": {
        "payments": {
          "0": {
            "offset": 500,
            "metadata": "",
            "timestamp": 1701432000000
          }
        }
      }
    }
  }
}
```

## Examples

### Pre-Migration Snapshot

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: pre-migration-snapshot
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  consumerGroups:
    - order-processor
    - payment-handler
    - notification-service
    - analytics-consumer

  operation: snapshot
  snapshotId: "pre-migration-20241201-1200"

  storage:
    storageType: s3
    s3:
      bucket: kafka-snapshots
      region: us-west-2
      prefix: offset-snapshots
```

### Emergency Rollback

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: emergency-rollback
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  consumerGroups:
    - order-processor  # Only rollback affected group

  operation: rollback
  snapshotId: "pre-migration-20241201-1200"

  storage:
    storageType: s3
    s3:
      bucket: kafka-snapshots
      region: us-west-2
      prefix: offset-snapshots
```

### Verification After Rollback

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: verify-rollback
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  consumerGroups:
    - order-processor

  operation: verify
  snapshotId: "pre-migration-20241201-1200"

  storage:
    storageType: s3
    s3:
      bucket: kafka-snapshots
      region: us-west-2
      prefix: offset-snapshots

  verify:
    strict: true  # Fail if any offset doesn't match
```

### Snapshot to ConfigMap

For small consumer groups:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: quick-snapshot
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  consumerGroups:
    - my-small-group

  operation: snapshot
  snapshotId: "quick-snapshot-001"

  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
```

## Operations

### List Snapshots

With S3 storage:
```bash
aws s3 ls s3://kafka-snapshots/offset-snapshots/
```

With ConfigMap:
```bash
kubectl get configmap offset-snapshots -o yaml
```

### Check Snapshot Contents

```bash
# S3
aws s3 cp s3://kafka-snapshots/offset-snapshots/pre-migration-20241201.json - | jq

# ConfigMap
kubectl get configmap offset-snapshots -o jsonpath='{.data.pre-migration-20241201\.json}' | jq
```

### Delete Old Snapshots

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: cleanup-old-snapshot
spec:
  operation: delete
  snapshotId: "old-snapshot-20241101"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
```

## Workflow Example

Complete workflow for safe offset management:

```yaml
# 1. Create snapshot before change
---
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: step1-snapshot
spec:
  kafkaCluster:
    bootstrapServers: ["kafka:9092"]
  consumerGroups: ["my-group"]
  operation: snapshot
  snapshotId: "before-change"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots

# 2. After change, if needed, rollback
---
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: step2-rollback
spec:
  kafkaCluster:
    bootstrapServers: ["kafka:9092"]
  consumerGroups: ["my-group"]
  operation: rollback
  snapshotId: "before-change"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots

# 3. Verify rollback succeeded
---
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: step3-verify
spec:
  kafkaCluster:
    bootstrapServers: ["kafka:9092"]
  consumerGroups: ["my-group"]
  operation: verify
  snapshotId: "before-change"
  storage:
    storageType: configMap
    configMap:
      name: offset-snapshots
```

## Next Steps

- [KafkaOffsetReset](./kafkaoffsetreset) - Reset without snapshot
- [Offset Management Guide](../../guides/offset-management) - Best practices
- [Offset Discontinuity](../../troubleshooting/offset-discontinuity) - Troubleshooting
