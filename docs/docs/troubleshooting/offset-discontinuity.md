---
title: Offset Discontinuity
description: Troubleshooting offset-related issues after restore
sidebar_position: 3
---

# Offset Discontinuity

After restoring Kafka data, consumers may encounter offset discontinuities. This guide explains the causes and solutions.

## Understanding the Problem

### What is Offset Discontinuity?

Kafka offsets are sequential numbers assigned to each message. After restore:

```
Source Cluster Offsets:        Target Cluster Offsets:
0, 1, 2, 3, 4, 5, ...         0, 1, 2, 3, 4, 5, ...
         │                             │
         ▼                             ▼
   Consumer at offset 1000       Consumer at offset ???
```

The problem: Consumer offset 1000 from source may not correspond to the same message in target.

### Why Do Offsets Change?

1. **Fresh topic starts at 0** - New topic always begins at offset 0
2. **PITR filtering** - Not all messages restored
3. **Compacted topics** - Different compaction state
4. **Different partition count** - Records redistributed

## Diagnosing Offset Issues

### Check Consumer Position

```bash
# Source cluster (before migration)
kafka-consumer-groups \
  --bootstrap-server source-kafka:9092 \
  --group order-processor \
  --describe

# Output:
# TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET
# orders    0          1000            1500
# orders    1          800             1200
```

### Check Restored Data

```bash
# Target cluster (after restore)
kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list target-kafka:9092 \
  --topic orders

# Output:
# orders:0:0:500     (partition 0 has 500 messages, starting at 0)
# orders:1:0:400     (partition 1 has 400 messages, starting at 0)
```

### Find Offset Mapping

```bash
# Use OSO Kafka Backup to find mapping
kafka-backup show-offset-mapping \
  --bootstrap-servers target-kafka:9092 \
  --topic orders \
  --source-cluster "source-cluster-id"

# Output:
# Partition 0: Source offset 500-1000 → Target offset 0-500
# Partition 1: Source offset 400-800 → Target offset 0-400
```

## Solutions

### Solution 1: Header-Based Offset Reset

OSO Kafka Backup stores original offsets in headers. Use this to find correct position:

```bash
# Generate offset reset plan
kafka-backup offset-reset plan \
  --bootstrap-servers target-kafka:9092 \
  --groups order-processor \
  --strategy header-based \
  --source-cluster "source-cluster-id" \
  --output reset-plan.json

# Review plan
cat reset-plan.json

# Execute
kafka-backup offset-reset execute \
  --plan reset-plan.json \
  --bootstrap-servers target-kafka:9092
```

Configuration:

```yaml
offset_reset:
  strategy: header-based
  source_cluster: "source-cluster-id"
  groups:
    - order-processor
    - payment-processor
```

### Solution 2: Timestamp-Based Reset

If headers aren't available, use timestamps:

```bash
# Reset to timestamp
kafka-consumer-groups \
  --bootstrap-server target-kafka:9092 \
  --group order-processor \
  --reset-offsets \
  --to-datetime 2024-12-01T10:00:00.000 \
  --all-topics \
  --execute
```

Or using OSO Kafka Backup:

```yaml
offset_reset:
  strategy: timestamp
  timestamp: 1701421200000  # Unix timestamp in milliseconds
  groups:
    - order-processor
```

### Solution 3: Start from Beginning

If reprocessing is acceptable:

```bash
kafka-consumer-groups \
  --bootstrap-server target-kafka:9092 \
  --group order-processor \
  --reset-offsets \
  --to-earliest \
  --all-topics \
  --execute
```

### Solution 4: Use Offset Mapping File

For precise control:

```bash
# Generate mapping during restore
kafka-backup restore \
  --config restore.yaml \
  --generate-offset-mapping \
  --mapping-output offset-mapping.json

# Apply mapping
kafka-backup offset-reset execute \
  --strategy from-mapping \
  --mapping-file offset-mapping.json \
  --groups order-processor
```

## Three-Phase Restore (Recommended)

The three-phase restore handles offset translation automatically:

```bash
kafka-backup three-phase-restore --config restore.yaml
```

What it does:

```
Phase 1: Restore Data
├── Restore messages to target
└── Include offset headers

Phase 2: Build Mapping
├── Scan restored messages
└── Build source→target offset map

Phase 3: Reset Offsets
├── Read consumer group positions
├── Translate to target offsets
└── Reset consumer groups
```

Configuration:

```yaml
mode: restore
backup_id: "my-backup"

target:
  bootstrap_servers:
    - target-kafka:9092

restore:
  include_original_offset_header: true
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-processor
    - payment-processor
    - notification-service

storage:
  backend: s3
  bucket: kafka-backups
  prefix: production
```

## Handling Specific Scenarios

### Scenario: PITR Restore

When using point-in-time recovery, some messages are excluded:

```
Source: Messages at T=1,2,3,4,5,6,7,8,9,10
PITR: Only restore T=3-7
Target: Messages at T=3,4,5,6,7 (offsets 0-4)

Consumer was at: T=5 (source offset 5)
Should be at: T=5 (target offset 2)
```

Solution:

```yaml
restore:
  time_window_start: 1701388800000  # T=3
  time_window_end: 1701410400000    # T=7
  include_original_offset_header: true

offset_reset:
  strategy: header-based
  # Will find T=5 in target and map correctly
```

### Scenario: Partition Count Change

When partition count differs:

```
Source: 6 partitions
Target: 12 partitions

Message with key "order-123":
  Source: Partition 2, Offset 500
  Target: Partition 8, Offset 50 (different partition!)
```

Solution:

```yaml
offset_reset:
  strategy: header-based
  scan_all_partitions: true  # Required for partition changes
```

### Scenario: Topic Remapping

When topics are renamed:

```yaml
restore:
  topic_mapping:
    orders: restored-orders
    payments: restored-payments

offset_reset:
  strategy: header-based
  topic_mapping:
    orders: restored-orders
    payments: restored-payments
```

### Scenario: Compacted Topics

Compacted topics may have different records:

```
Source: Keys A(v1), B(v1), A(v2), C(v1), B(v2)
        Compacted: A(v2), C(v1), B(v2)

Backup: A(v2), C(v1), B(v2) (3 records)

Target after restore: A(v2), C(v1), B(v2) at offsets 0,1,2
```

For compacted topics, timestamp or header-based reset works best.

## Offset Rollback

If offset reset causes problems, rollback to previous position:

### Create Snapshot Before Reset

```bash
# Snapshot current offsets
kafka-backup offset-rollback snapshot \
  --bootstrap-servers target-kafka:9092 \
  --groups order-processor \
  --output pre-reset-snapshot.json

# Perform reset
kafka-backup offset-reset execute ...

# If problems, rollback
kafka-backup offset-rollback rollback \
  --bootstrap-servers target-kafka:9092 \
  --snapshot pre-reset-snapshot.json
```

### Using the Operator

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaOffsetRollback
metadata:
  name: rollback-order-processor
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  consumerGroups:
    - order-processor
  operation: snapshot
  snapshotId: pre-reset
```

## Verifying Offset Correctness

### Check Message at Position

```bash
# Get message at specific offset
kafka-console-consumer \
  --bootstrap-server target-kafka:9092 \
  --topic orders \
  --partition 0 \
  --offset 100 \
  --max-messages 1 \
  --property print.headers=true
```

Look for `x-kafka-backup-offset` header to verify original offset.

### Compare Source and Target

```bash
# Source message at offset 1000
kafka-console-consumer \
  --bootstrap-server source-kafka:9092 \
  --topic orders \
  --partition 0 \
  --offset 1000 \
  --max-messages 1 \
  --property print.key=true

# Target message (should be same content)
kafka-console-consumer \
  --bootstrap-server target-kafka:9092 \
  --topic orders \
  --partition 0 \
  --offset 500 \
  --max-messages 1 \
  --property print.key=true
```

### Verify Consumer Group

```bash
# Check consumer group can consume
kafka-consumer-groups \
  --bootstrap-server target-kafka:9092 \
  --group order-processor \
  --describe

# LAG should be reasonable after reset
```

## Best Practices

1. **Always include offset headers** during backup
2. **Use three-phase restore** for complete migrations
3. **Take offset snapshots** before any reset
4. **Test with single consumer group** before bulk reset
5. **Verify data correctness** after reset
6. **Monitor consumer lag** after restart

## Troubleshooting Checklist

- [ ] Was backup created with `include_offset_headers: true`?
- [ ] Is `source_cluster_id` correctly specified?
- [ ] Are consumer groups stopped before reset?
- [ ] Is the correct strategy being used?
- [ ] For partition changes, is `scan_all_partitions` enabled?
- [ ] Are topic mappings consistent between restore and offset reset?

## Next Steps

- [Offset Management Guide](../guides/offset-management) - Detailed offset operations
- [Offset Translation Architecture](../architecture/offset-translation) - How it works
- [CLI Reference](../reference/cli-reference#offset-reset) - Command options
