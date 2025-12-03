---
title: Offset Management
description: Manage consumer group offsets during backup and restore operations
sidebar_position: 3
---

# Offset Management

Managing consumer group offsets is critical when restoring Kafka data. This guide covers offset concepts and management strategies.

## Understanding Offsets

### What Are Offsets?

Kafka offsets are sequential IDs assigned to each message in a partition:

```
Partition 0:
┌────┬────┬────┬────┬────┬────┬────┐
│ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │  ← Offsets
└────┴────┴────┴────┴────┴────┴────┘
  ↑                        ↑
  Earliest                 Latest (High Watermark)
```

### Consumer Group Offsets

Consumer groups track their position (committed offset) in each partition:

```
Consumer Group: order-processor
  orders-0: committed offset 5 (next to read: 6)
  orders-1: committed offset 3 (next to read: 4)
  orders-2: committed offset 7 (next to read: 8)
```

### The Restore Challenge

When data is restored, original offsets don't match the new offsets:

```
Original Cluster:       Restored Cluster:
┌────┬────┬────┬────┐   ┌────┬────┬────┬────┐
│ 0  │ 1  │ 2  │ 3  │   │ 0  │ 1  │ 2  │ 3  │
└────┴────┴────┴────┘   └────┴────┴────┴────┘
Consumer at offset 2     Consumer still thinks offset 2
                         but data changed!
```

## Offset Strategies

### Strategy 1: Skip (Manual Later)

Don't modify offsets during restore. Handle manually afterward.

```yaml
restore:
  consumer_group_strategy: skip
```

Best for:
- Development/testing environments
- When consumers will reprocess all data anyway
- Manual offset management workflows

### Strategy 2: Header-Based

Store original offset in message headers. Consumers read headers to track position.

```yaml
restore:
  consumer_group_strategy: header-based
  include_original_offset_header: true
```

Each restored message includes:
```
Headers:
  x-kafka-backup-offset: "12345"
  x-kafka-backup-timestamp: "1701234567890"
  x-kafka-backup-partition: "0"
```

### Strategy 3: Automatic Reset

Reset consumer offsets as part of the restore process.

```yaml
restore:
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-processor
    - payment-service
    - analytics-consumer
```

## Viewing Offset Mapping

After backup, view the offset mapping:

```bash
kafka-backup show-offset-mapping \
  --path /data/backups \
  --backup-id production-backup-001
```

Output:

```
Offset Mapping: production-backup-001
══════════════════════════════════════════════════════════════

Topic: orders
─────────────────────────────────────────────────────────────
Partition  First Offset  Last Offset  Record Count
─────────────────────────────────────────────────────────────
0          0             150233       150234
1          0             148891       148892
2          0             152456       152457

Topic: payments
─────────────────────────────────────────────────────────────
Partition  First Offset  Last Offset  Record Count
─────────────────────────────────────────────────────────────
0          0             78234        78235
1          0             76543        76544
```

Export as CSV for analysis:

```bash
kafka-backup show-offset-mapping \
  --path /data/backups \
  --backup-id production-backup-001 \
  --format csv > offset-mapping.csv
```

## Manual Offset Reset

### Using Kafka Tools

```bash
# Reset to earliest
kafka-consumer-groups \
  --bootstrap-server kafka:9092 \
  --group order-processor \
  --topic orders \
  --reset-offsets \
  --to-earliest \
  --execute

# Reset to specific offset
kafka-consumer-groups \
  --bootstrap-server kafka:9092 \
  --group order-processor \
  --topic orders:0 \
  --reset-offsets \
  --to-offset 150233 \
  --execute

# Reset to timestamp
kafka-consumer-groups \
  --bootstrap-server kafka:9092 \
  --group order-processor \
  --topic orders \
  --reset-offsets \
  --to-datetime 2024-12-01T10:00:00.000 \
  --execute
```

### Using kafka-backup CLI

#### Generate Reset Plan

```bash
kafka-backup offset-reset plan \
  --path /data/backups \
  --backup-id production-backup-001 \
  --groups order-processor,payment-service \
  --bootstrap-servers kafka:9092
```

Output:

```
Offset Reset Plan
══════════════════════════════════════════════════════════════

Consumer Group: order-processor
─────────────────────────────────────────────────────────────
Topic      Partition  Current  Target   Action
─────────────────────────────────────────────────────────────
orders     0          -        150233   SET
orders     1          -        148891   SET
orders     2          -        152456   SET

Consumer Group: payment-service
─────────────────────────────────────────────────────────────
payments   0          -        78234    SET
payments   1          -        76543    SET

Total partitions to reset: 5
```

#### Execute Reset

```bash
kafka-backup offset-reset execute \
  --path /data/backups \
  --backup-id production-backup-001 \
  --groups order-processor \
  --bootstrap-servers kafka:9092
```

#### Generate Shell Script

For review before execution:

```bash
kafka-backup offset-reset script \
  --path /data/backups \
  --backup-id production-backup-001 \
  --groups order-processor \
  --bootstrap-servers kafka:9092 \
  --output reset-offsets.sh
```

Generated script:

```bash
#!/bin/bash
# Offset reset script for backup: production-backup-001
# Generated: 2024-12-03T10:00:00Z

# Stop consumers before running this script!

kafka-consumer-groups --bootstrap-server kafka:9092 \
  --group order-processor \
  --topic orders:0 \
  --reset-offsets --to-offset 150233 --execute

kafka-consumer-groups --bootstrap-server kafka:9092 \
  --group order-processor \
  --topic orders:1 \
  --reset-offsets --to-offset 148891 --execute

# ... more commands
```

## Bulk Offset Reset

For large numbers of partitions, use bulk reset:

```bash
kafka-backup offset-reset-bulk \
  --path /data/backups \
  --backup-id production-backup-001 \
  --groups order-processor,payment-service,analytics \
  --bootstrap-servers kafka:9092 \
  --max-concurrent 100
```

Benefits:
- ~50x faster than sequential reset
- Per-partition retry with backoff
- Detailed progress reporting
- Performance metrics (p50/p99 latency)

## Offset Snapshots and Rollback

### Create Snapshot Before Changes

```bash
kafka-backup offset-rollback snapshot \
  --path /data/offset-snapshots \
  --groups order-processor,payment-service \
  --bootstrap-servers kafka:9092 \
  --description "Before restore operation"
```

### List Snapshots

```bash
kafka-backup offset-rollback list \
  --path /data/offset-snapshots
```

Output:

```
Offset Snapshots
══════════════════════════════════════════════════════════════
ID                          Created               Groups  Description
──────────────────────────────────────────────────────────────
snapshot-20241203-100000    2024-12-03T10:00:00Z  2       Before restore
snapshot-20241203-090000    2024-12-03T09:00:00Z  2       Before migration
```

### View Snapshot Details

```bash
kafka-backup offset-rollback show \
  --path /data/offset-snapshots \
  --snapshot-id snapshot-20241203-100000
```

### Rollback to Snapshot

If something goes wrong:

```bash
kafka-backup offset-rollback rollback \
  --path /data/offset-snapshots \
  --snapshot-id snapshot-20241203-100000 \
  --bootstrap-servers kafka:9092
```

### Verify Offsets Match Snapshot

```bash
kafka-backup offset-rollback verify \
  --path /data/offset-snapshots \
  --snapshot-id snapshot-20241203-100000 \
  --bootstrap-servers kafka:9092
```

## Three-Phase Restore

For complete automated recovery:

```yaml title="three-phase-restore.yaml"
mode: restore
backup_id: "production-backup-001"

target:
  bootstrap_servers:
    - kafka-dr:9092

storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2

restore:
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-processor
    - payment-service
    - analytics-consumer
```

```bash
kafka-backup three-phase-restore --config three-phase-restore.yaml
```

Phases:

1. **Phase 1**: Collect offset headers from backup
2. **Phase 2**: Restore data to target cluster
3. **Phase 3**: Reset consumer group offsets

## Best Practices

### Before Restore

1. **Stop consumers** - Prevent offset commits during restore
2. **Snapshot current offsets** - Enable rollback if needed
3. **Document consumer groups** - Know which groups need reset

### During Restore

1. **Use header-based strategy** - Preserve original offset information
2. **Enable dry-run first** - Validate configuration
3. **Monitor progress** - Watch for errors

### After Restore

1. **Verify offset mapping** - Check offsets are set correctly
2. **Start consumers gradually** - Monitor for reprocessing issues
3. **Keep snapshots** - Retain for potential rollback

## Troubleshooting

### Consumer Group Not Found

```
Error: Consumer group 'my-group' not found
```

The group may not exist if:
- Consumers never started
- Group was deleted
- Using incorrect group name

Solution: Create the group by starting a consumer, or use `--reset-offsets --to-earliest --dry-run` first.

### Offsets Out of Range

```
Error: Offset 150000 is out of range for partition 0 (current: 0-100)
```

Target offset doesn't exist in restored topic. This can happen with PITR restores.

Solution: Reset to `--to-earliest` or `--to-latest` instead of specific offset.

### Consumer Still Running

```
Error: Consumer group has active members
```

Stop all consumers before resetting offsets:

```bash
# Check active members
kafka-consumer-groups \
  --bootstrap-server kafka:9092 \
  --group order-processor \
  --describe --members
```

## Next Steps

- [Three-Phase Restore](../reference/cli-reference#three-phase-restore) - Automated restore
- [Performance Tuning](./performance-tuning) - Optimize operations
- [Disaster Recovery](../use-cases/disaster-recovery) - DR planning
