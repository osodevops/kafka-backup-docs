---
title: KafkaOffsetReset
description: KafkaOffsetReset Custom Resource Definition reference
sidebar_position: 3
---

# KafkaOffsetReset CRD

The `KafkaOffsetReset` custom resource defines a consumer group offset reset operation.

## Overview

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: my-offset-reset
  namespace: kafka-backup
spec:
  strategy: timestamp
  # Reset configuration
```

## Full Specification

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: offset-reset
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

  # Consumer groups to reset
  consumerGroups:
    - order-processor
    - payment-handler
    - notification-service

  # Topics (optional - defaults to all topics in group)
  topics:
    - orders
    - payments

  # Reset strategy (required)
  strategy: timestamp  # earliest, latest, timestamp, offset, headerBased, fromMapping

  # Strategy-specific options

  # For timestamp strategy
  timestamp: "2024-12-01T12:00:00Z"
  # Or: timestampMillis: 1701432000000

  # For offset strategy
  offset: 1000

  # For headerBased strategy
  sourceCluster: "production-us-west-2"
  scanAllPartitions: false  # Set true if partition count changed

  # For fromMapping strategy
  mappingConfigMap:
    name: offset-mapping
    key: mapping.json

  # Create snapshot before reset
  createSnapshot: true
  snapshotId: "pre-reset-snapshot"

  # Parallel execution for bulk resets
  parallelism: 10

  # Dry run mode
  dryRun: false

  # Resource requirements
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

  # Job configuration
  job:
    backoffLimit: 3
    activeDeadlineSeconds: 1800
    ttlSecondsAfterFinished: 3600
```

## Spec Fields

### kafkaCluster

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bootstrapServers` | []string | Yes | Kafka broker addresses |
| `securityProtocol` | string | No | Security protocol |
| `tlsSecret` | object | No | TLS certificate secret |
| `saslSecret` | object | No | SASL credentials secret |

### strategy

| Value | Description |
|-------|-------------|
| `earliest` | Reset to earliest available offset |
| `latest` | Reset to latest offset |
| `timestamp` | Reset to first offset >= timestamp |
| `offset` | Reset to specific offset |
| `headerBased` | Find offset using backup headers |
| `fromMapping` | Use pre-generated offset mapping |

### Strategy Options

#### timestamp

```yaml
strategy: timestamp
timestamp: "2024-12-01T12:00:00Z"
# Or
timestampMillis: 1701432000000
```

#### offset

```yaml
strategy: offset
offset: 1000
# Applies to all partitions
```

#### headerBased

```yaml
strategy: headerBased
sourceCluster: "production-us-west-2"
scanAllPartitions: false  # True if partitions changed
```

#### fromMapping

```yaml
strategy: fromMapping
mappingConfigMap:
  name: offset-mapping
  key: mapping.json
```

Mapping format:
```json
{
  "groups": {
    "order-processor": {
      "orders": {
        "0": 1000,
        "1": 2000,
        "2": 1500
      }
    }
  }
}
```

## Status

```yaml
status:
  phase: Completed  # Pending, Running, Completed, Failed
  startTime: "2024-12-01T12:00:00Z"
  completionTime: "2024-12-01T12:01:00Z"
  groupsReset: 3
  snapshotId: "pre-reset-snapshot"
  results:
    - group: order-processor
      status: success
      partitionsReset: 6
    - group: payment-handler
      status: success
      partitionsReset: 3
    - group: notification-service
      status: success
      partitionsReset: 3
  conditions:
    - type: Ready
      status: "True"
      reason: ResetCompleted
      message: "All consumer groups reset successfully"
      lastTransitionTime: "2024-12-01T12:01:00Z"
```

## Examples

### Reset to Earliest

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: reset-to-earliest
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  consumerGroups:
    - my-consumer-group
  strategy: earliest
```

### Reset to Timestamp

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: reset-to-timestamp
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

  strategy: timestamp
  timestamp: "2024-12-01T10:00:00Z"

  createSnapshot: true
  snapshotId: "before-reset-20241201"
```

### Header-Based Reset (After Restore)

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: post-restore-reset
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  consumerGroups:
    - order-processor
    - payment-handler
    - notification-service

  strategy: headerBased
  sourceCluster: "production-us-west-2"

  createSnapshot: true
  snapshotId: "pre-header-reset"
```

### Bulk Reset with Parallelism

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: bulk-reset
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  consumerGroups:
    - group-1
    - group-2
    - group-3
    - group-4
    - group-5
    # ... many groups

  strategy: earliest
  parallelism: 50  # Reset up to 50 groups in parallel
```

### Dry Run

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: dry-run-reset
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  consumerGroups:
    - order-processor

  strategy: timestamp
  timestamp: "2024-12-01T10:00:00Z"

  dryRun: true  # Only show what would be reset
```

### From Mapping File

First create the mapping ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: offset-mapping
  namespace: kafka-backup
data:
  mapping.json: |
    {
      "groups": {
        "order-processor": {
          "orders": {"0": 1000, "1": 2000},
          "payments": {"0": 500}
        }
      }
    }
```

Then reference it:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetReset
metadata:
  name: reset-from-mapping
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  consumerGroups:
    - order-processor

  strategy: fromMapping
  mappingConfigMap:
    name: offset-mapping
    key: mapping.json
```

## Operations

### Check Reset Status

```bash
kubectl get kafkaoffsetreset my-reset -o jsonpath='{.status.phase}'
```

### View Reset Results

```bash
kubectl get kafkaoffsetreset my-reset -o yaml | grep -A 30 status
```

### Verify Consumer Group After Reset

```bash
kubectl exec -it kafka-0 -- kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group order-processor \
  --describe
```

## Important Notes

1. **Stop consumers first** - Consumer groups must be inactive for reset
2. **Use snapshots** - Enable `createSnapshot` for safety
3. **Test with dry run** - Verify before actual reset
4. **Check lag after** - Verify consumers resume correctly

## Next Steps

- [KafkaOffsetRollback](./kafkaoffsetrollback) - Rollback if needed
- [Offset Management Guide](../../guides/offset-management) - Best practices
- [Offset Discontinuity](../../troubleshooting/offset-discontinuity) - Troubleshooting
