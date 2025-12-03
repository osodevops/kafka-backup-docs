---
title: Disaster Recovery
description: Use OSO Kafka Backup for zero-downtime disaster recovery
sidebar_position: 1
---

# Disaster Recovery

Implement robust disaster recovery for your Kafka infrastructure with OSO Kafka Backup.

## The Problem

Kafka replication (MirrorMaker, Confluent Replicator) provides high availability but has limitations:

| Challenge | Impact |
|-----------|--------|
| **Active-active complexity** | Dual writes, conflict resolution |
| **Data corruption propagates** | Replication copies bad data too |
| **No point-in-time recovery** | Can't go back to "before the incident" |
| **Topic deletion is permanent** | Accidentally deleted topics can't be recovered |
| **High cross-region costs** | Continuous replication is expensive |

## The Solution

OSO Kafka Backup provides true disaster recovery:

- **Point-in-time recovery**: Restore to any moment
- **Isolated backups**: Corruption doesn't propagate
- **Cost-effective**: Backup storage vs. active replication
- **Flexible recovery**: Full or partial restore

## DR Architecture

```
Production Region                    DR Region
┌─────────────────┐                 ┌─────────────────┐
│                 │                 │                 │
│  Kafka Cluster  │───Backup───────▶│   S3 Bucket     │
│                 │                 │                 │
│  ┌───────────┐  │                 │  ┌───────────┐  │
│  │ Topic A   │  │                 │  │  Backups  │  │
│  │ Topic B   │  │                 │  └───────────┘  │
│  │ Topic C   │  │                 │                 │
│  └───────────┘  │                 └────────┬────────┘
│                 │                          │
└─────────────────┘                          │
                                             │ Restore
                                             ▼
                                   ┌─────────────────┐
                                   │  DR Kafka       │
                                   │  Cluster        │
                                   │  ┌───────────┐  │
                                   │  │ Topic A   │  │
                                   │  │ Topic B   │  │
                                   │  │ Topic C   │  │
                                   │  └───────────┘  │
                                   └─────────────────┘
```

## DR Scenarios

### Scenario 1: Regional Failure

**Situation**: Entire production region becomes unavailable.

**Recovery**:

1. Activate DR Kafka cluster
2. Restore from latest backup
3. Reset consumer offsets
4. Redirect applications to DR cluster

**RTO**: 30 minutes - 2 hours (depending on data volume)
**RPO**: Last backup (typically 15 minutes - 1 hour)

### Scenario 2: Data Corruption

**Situation**: Bad data published to topics, affecting consumers.

**Recovery**:

1. Identify corruption timestamp
2. PITR restore to just before corruption
3. Continue from clean state

```yaml
restore:
  time_window_end: 1701234500000  # Just before corruption
```

### Scenario 3: Accidental Topic Deletion

**Situation**: Critical topic accidentally deleted.

**Recovery**:

1. Identify which backup contains the topic
2. Restore specific topic
3. Resume operations

```yaml
restore:
  topics:
    - accidentally-deleted-topic
```

### Scenario 4: Ransomware Attack

**Situation**: Kafka cluster compromised, data encrypted.

**Recovery**:

1. Provision new cluster (isolated)
2. Restore from clean backup
3. Validate data integrity
4. Cut over to new cluster

## Implementation

### Step 1: Configure Automated Backups

```yaml title="dr-backup.yaml"
mode: backup
backup_id: "production-${TIMESTAMP}"

source:
  bootstrap_servers:
    - kafka-prod-1:9092
    - kafka-prod-2:9092
    - kafka-prod-3:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: backup-service
    sasl_password: ${KAFKA_PASSWORD}
  topics:
    include:
      - "*"
    exclude:
      - "__consumer_offsets"
      - "_schemas"

storage:
  backend: s3
  bucket: kafka-dr-backups
  region: us-east-1  # DR region
  prefix: production/hourly

backup:
  compression: zstd
  compression_level: 3
  checkpoint_interval_secs: 30
  include_offset_headers: true
  source_cluster_id: "prod-us-west-2"
```

### Step 2: Schedule Backups

**Kubernetes Operator**:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: dr-backup
spec:
  schedule: "0 * * * *"  # Hourly
  kafkaCluster:
    bootstrapServers:
      - kafka-prod-1:9092
  topics:
    - "*"
  storage:
    storageType: s3
    s3:
      bucket: kafka-dr-backups
      region: us-east-1
```

### Step 3: Create DR Runbook

```bash
#!/bin/bash
# dr-restore.sh - Disaster Recovery Runbook

BACKUP_ID="${1:-latest}"
DR_CLUSTER="kafka-dr-1:9092,kafka-dr-2:9092,kafka-dr-3:9092"

echo "=== Kafka Disaster Recovery ==="
echo "Backup ID: $BACKUP_ID"
echo "Target: $DR_CLUSTER"

# 1. Validate backup
echo "Step 1: Validating backup..."
kafka-backup validate \
  --path s3://kafka-dr-backups/production/hourly \
  --backup-id "$BACKUP_ID" \
  --deep

# 2. Validate restore configuration
echo "Step 2: Validating restore config..."
kafka-backup validate-restore --config dr-restore.yaml

# 3. Execute restore
echo "Step 3: Executing restore..."
kafka-backup three-phase-restore --config dr-restore.yaml

# 4. Verify
echo "Step 4: Verifying restore..."
kafka-topics --bootstrap-server "$DR_CLUSTER" --list

echo "=== DR Complete ==="
```

### Step 4: Test DR Regularly

Create a DR test schedule:

| Test Type | Frequency | Description |
|-----------|-----------|-------------|
| Backup validation | Daily | Verify backup integrity |
| Restore test | Weekly | Restore to test cluster |
| Full DR drill | Quarterly | Complete failover simulation |

## RTO/RPO Planning

### Recovery Time Objective (RTO)

Time to restore service:

| Data Volume | RTO Estimate |
|-------------|--------------|
| < 10 GB | 15-30 minutes |
| 10-100 GB | 30-60 minutes |
| 100 GB - 1 TB | 1-2 hours |
| > 1 TB | 2-4 hours |

**Factors affecting RTO**:
- Network bandwidth to DR region
- Target cluster capacity
- Number of topics/partitions
- Consumer offset reset time

### Recovery Point Objective (RPO)

Maximum acceptable data loss:

| Backup Frequency | RPO |
|------------------|-----|
| Continuous | ~1 minute |
| Every 15 minutes | 15 minutes |
| Hourly | 1 hour |
| Daily | 24 hours |

**Choose based on**:
- Data criticality
- Backup costs
- Compliance requirements

## Cost Analysis

### Replication vs. Backup

| Approach | Monthly Cost (100 GB/day) |
|----------|---------------------------|
| Active-Active (MirrorMaker) | $$$$ (2x infrastructure + transfer) |
| Cross-region replication | $$$ (transfer costs) |
| Hourly backup to S3 | $ (storage + occasional transfer) |
| Daily backup to S3 | $ (storage + rare transfer) |

### Backup Storage Costs

```
Monthly storage = daily_backup_size × retention_days × storage_cost

Example:
  10 GB/day × 30 days × $0.023/GB = $6.90/month (S3 Standard)
  With 4x compression: $1.73/month
  With Glacier after 30 days: Even less
```

## Best Practices

### Backup Strategy

1. **Multiple backup frequencies**
   - Hourly for critical data
   - Daily for full backups
   - Weekly for long-term retention

2. **Cross-region storage**
   - Store backups in DR region
   - Consider multi-region buckets

3. **Encryption**
   - Enable storage encryption
   - Use customer-managed keys

### DR Readiness

1. **Pre-provision DR cluster**
   - Keep cluster running (minimal)
   - Or use auto-scaling on demand

2. **Automate everything**
   - Scripted restore process
   - Infrastructure as code

3. **Regular testing**
   - Monthly restore tests
   - Quarterly full DR drills

## Consumer Recovery

After restore, consumers need attention:

### Option 1: Reprocess All

```bash
kafka-consumer-groups \
  --bootstrap-server kafka-dr:9092 \
  --group my-consumer \
  --reset-offsets \
  --to-earliest \
  --execute
```

### Option 2: Resume from Position

Use three-phase restore with offset reset:

```yaml
restore:
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-processor
    - payment-service
```

### Option 3: Timestamp-Based Resume

```bash
kafka-consumer-groups \
  --bootstrap-server kafka-dr:9092 \
  --group my-consumer \
  --reset-offsets \
  --to-datetime 2024-12-01T10:00:00.000 \
  --execute
```

## Next Steps

- [Point-in-Time Recovery](../guides/restore-pitr) - PITR implementation
- [Offset Management](../guides/offset-management) - Consumer recovery
- [Kubernetes Operator](../operator) - Automated DR backups
