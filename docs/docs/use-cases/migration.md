---
title: Migration
description: Use OSO Kafka Backup for Kafka cluster migrations
sidebar_position: 3
---

# Migration

Migrate Kafka data between clusters, versions, or cloud providers using OSO Kafka Backup.

## Migration Scenarios

| Scenario | Example |
|----------|---------|
| **Version upgrade** | Kafka 2.x → Kafka 3.x |
| **Cloud migration** | On-premises → AWS MSK |
| **Provider switch** | AWS MSK → Confluent Cloud |
| **Region migration** | us-east-1 → eu-west-1 |
| **Environment cloning** | Production → Staging |
| **Cluster consolidation** | Multiple clusters → One |

## Why Use Backup for Migration?

### vs. MirrorMaker

| Feature | MirrorMaker | Kafka Backup |
|---------|-------------|--------------|
| Live sync | Yes | No |
| PITR | No | Yes |
| Data transformation | Limited | Plugin support |
| Topic remapping | Yes | Yes |
| Offset preservation | Complex | Built-in |
| Network requirement | Continuous | One-time |

**Choose Kafka Backup when**:
- Clusters can't communicate directly
- You need data transformation during migration
- You want to select specific time ranges
- Minimizing cross-region bandwidth is important

## Migration Process

### Step 1: Assess Source Cluster

```bash
# List topics
kafka-topics --bootstrap-server source-kafka:9092 --list

# Get topic details
kafka-topics --bootstrap-server source-kafka:9092 --describe

# Check data volume
kafka-log-dirs --bootstrap-server source-kafka:9092 --describe
```

### Step 2: Plan Migration

**Consider**:
- Total data volume
- Number of topics and partitions
- Consumer groups to migrate
- Acceptable downtime
- Topic naming changes

### Step 3: Backup Source Cluster

```yaml title="migration-backup.yaml"
mode: backup
backup_id: "migration-$(date +%Y%m%d)"

source:
  bootstrap_servers:
    - source-kafka-1:9092
    - source-kafka-2:9092
  topics:
    include:
      - "*"
    exclude:
      - "__consumer_offsets"
      - "_schemas"

storage:
  backend: s3
  bucket: kafka-migration
  region: us-west-2
  prefix: migration/source-cluster

backup:
  compression: zstd
  include_offset_headers: true
  source_cluster_id: "source-cluster"
```

```bash
kafka-backup backup --config migration-backup.yaml
```

### Step 4: Validate Backup

```bash
# List backup
kafka-backup list --path s3://kafka-migration/migration/source-cluster

# Describe backup
kafka-backup describe \
  --path s3://kafka-migration/migration/source-cluster \
  --backup-id "migration-20241203"

# Deep validation
kafka-backup validate \
  --path s3://kafka-migration/migration/source-cluster \
  --backup-id "migration-20241203" \
  --deep
```

### Step 5: Restore to Target Cluster

```yaml title="migration-restore.yaml"
mode: restore
backup_id: "migration-20241203"

target:
  bootstrap_servers:
    - target-kafka-1:9092
    - target-kafka-2:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: admin
    sasl_password: ${KAFKA_PASSWORD}

storage:
  backend: s3
  bucket: kafka-migration
  region: us-west-2
  prefix: migration/source-cluster

restore:
  # Optional: Remap topic names
  topic_mapping:
    old-topic-name: new-topic-name

  # Optional: Change partition count
  # (must be >= source partitions)

  include_original_offset_header: true
  consumer_group_strategy: skip
```

```bash
# Validate first
kafka-backup validate-restore --config migration-restore.yaml

# Execute restore
kafka-backup restore --config migration-restore.yaml
```

### Step 6: Migrate Consumer Offsets

```bash
# Option 1: Reset to beginning (reprocess all)
kafka-consumer-groups \
  --bootstrap-server target-kafka:9092 \
  --group my-consumer \
  --reset-offsets \
  --to-earliest \
  --all-topics \
  --execute

# Option 2: Use offset mapping from backup
kafka-backup offset-reset execute \
  --path s3://kafka-migration/migration/source-cluster \
  --backup-id "migration-20241203" \
  --groups my-consumer \
  --bootstrap-servers target-kafka:9092

# Option 3: Three-phase restore (automated)
kafka-backup three-phase-restore --config migration-restore.yaml
```

### Step 7: Verify Migration

```bash
# Compare topic counts
echo "Source topics:"
kafka-topics --bootstrap-server source-kafka:9092 --list | wc -l

echo "Target topics:"
kafka-topics --bootstrap-server target-kafka:9092 --list | wc -l

# Verify record counts
kafka-backup describe \
  --path s3://kafka-migration/migration/source-cluster \
  --backup-id "migration-20241203" \
  --format json | jq '.statistics.records'

# Sample data verification
kafka-console-consumer \
  --bootstrap-server target-kafka:9092 \
  --topic my-topic \
  --from-beginning \
  --max-messages 10
```

### Step 8: Cutover

1. **Stop producers** to source cluster
2. **Final backup** (capture last changes)
3. **Final restore** to target
4. **Update consumer offsets** on target
5. **Redirect applications** to target cluster
6. **Monitor** for issues
7. **Decommission** source cluster

## Special Migration Scenarios

### Production to Development

Clone production data to dev/staging with data masking:

```yaml
mode: restore
backup_id: "production-backup"

target:
  bootstrap_servers:
    - dev-kafka:9092

restore:
  topic_mapping:
    orders: dev-orders
    users: dev-users

# Enterprise: Data masking via plugins
# plugins:
#   - name: pii-masker
#     config:
#       fields_to_mask:
#         - email
#         - ssn
```

### Multi-Cluster Consolidation

Migrate from multiple source clusters:

```bash
# Backup cluster A
kafka-backup backup --config cluster-a-backup.yaml

# Backup cluster B
kafka-backup backup --config cluster-b-backup.yaml

# Restore both to target (with prefix)
kafka-backup restore --config cluster-a-restore.yaml
kafka-backup restore --config cluster-b-restore.yaml
```

```yaml title="cluster-a-restore.yaml"
restore:
  topic_mapping:
    orders: cluster-a/orders
    payments: cluster-a/payments
```

### Cross-Cloud Migration

AWS MSK → Confluent Cloud:

```yaml title="msk-backup.yaml"
source:
  bootstrap_servers:
    - b-1.msk-cluster.abc123.kafka.us-east-1.amazonaws.com:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: AWS_MSK_IAM
    # Uses AWS credentials

storage:
  backend: s3
  bucket: migration-data
  region: us-east-1
```

```yaml title="confluent-restore.yaml"
target:
  bootstrap_servers:
    - pkc-xxxxx.us-west-2.aws.confluent.cloud:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: PLAIN
    sasl_username: ${CONFLUENT_API_KEY}
    sasl_password: ${CONFLUENT_API_SECRET}

storage:
  backend: s3
  bucket: migration-data
  region: us-east-1
```

### Selective Topic Migration

Migrate only specific topics:

```yaml
source:
  topics:
    include:
      - orders
      - payments
      - "events-*"
    exclude:
      - events-debug
```

### Partition Reconfiguration

Change partition count during migration:

1. Backup with original partitions
2. Create topics on target with desired partitions
3. Restore (data redistributes across partitions)

```bash
# Create topic with more partitions
kafka-topics --bootstrap-server target-kafka:9092 \
  --create --topic orders \
  --partitions 12 \
  --replication-factor 3

# Restore will use existing topic configuration
kafka-backup restore --config restore.yaml
```

## Downtime Strategies

### Zero-Downtime Migration

1. Set up continuous backup from source
2. Start consumers on target (dual-read)
3. Gradually migrate producers
4. Disable source consumers
5. Stop source backup

### Minimal Downtime Migration

1. Initial full backup/restore
2. Delta backup during cutover window
3. Delta restore
4. Switch applications

### Scheduled Downtime Migration

1. Stop all applications
2. Full backup
3. Full restore
4. Restart applications pointing to target

## Rollback Plan

Always have a rollback strategy:

```yaml title="rollback-backup.yaml"
# Before migration, backup target cluster state
mode: backup
backup_id: "pre-migration-rollback"

source:
  bootstrap_servers:
    - target-kafka:9092
  topics:
    include:
      - "*"

storage:
  backend: s3
  bucket: kafka-migration
  prefix: rollback
```

## Best Practices

1. **Test with subset first** - Migrate few topics as pilot
2. **Validate at each step** - Don't proceed with errors
3. **Document everything** - Record all steps taken
4. **Have rollback ready** - Plan for failure
5. **Monitor closely** - Watch for data discrepancies
6. **Communicate cutover** - Coordinate with stakeholders

## Next Steps

- [Disaster Recovery](./disaster-recovery) - DR planning
- [Offset Management](../guides/offset-management) - Consumer migration
- [Performance Tuning](../guides/performance-tuning) - Optimize migration speed
