---
title: Offset Translation
description: Understanding how OSO Kafka Backup handles offset mapping between clusters
sidebar_position: 2
---

# Offset Translation

One of the most challenging aspects of Kafka backup and restore is maintaining consumer position across clusters. OSO Kafka Backup solves this through offset translation.

## The Offset Problem

### Why Offsets Don't Transfer Directly

Kafka offsets are cluster-specific and cannot be directly transferred:

```
Source Cluster                    Target Cluster
┌────────────────────────┐       ┌────────────────────────┐
│ Topic: orders          │       │ Topic: orders          │
│ ┌────────────────────┐ │       │ ┌────────────────────┐ │
│ │ Offset 0: Order A  │ │  ───▶ │ │ Offset 0: Order A  │ │
│ │ Offset 1: Order B  │ │       │ │ Offset 1: Order B  │ │
│ │ Offset 2: Order C  │ │       │ │ Offset 2: Order C  │ │
│ │ ...                │ │       │ │ ...                │ │
│ │ Offset 999: Last   │ │       │ │ Offset 999: Last   │ │
│ └────────────────────┘ │       └────────────────────────┘
└────────────────────────┘
                                 ❌ Offsets may differ!
```

Offsets can differ because:

1. **Compacted topics** - Different compaction states
2. **Partial restore** - PITR excludes some messages
3. **Topic recreation** - Fresh topic starts at 0
4. **Partition changes** - Different partition count

### The Solution: Header-Based Translation

OSO Kafka Backup stores original offset information in message headers:

```
Original Message (Source)          Restored Message (Target)
┌─────────────────────────┐       ┌─────────────────────────┐
│ Offset: 12345           │       │ Offset: 100             │
│ Key: order-123          │  ───▶ │ Key: order-123          │
│ Value: {...}            │       │ Value: {...}            │
│ Headers: []             │       │ Headers:                │
│                         │       │   x-kafka-backup-offset │
│                         │       │     : 12345             │
│                         │       │   x-kafka-backup-partition
│                         │       │     : 0                 │
│                         │       │   x-kafka-backup-cluster│
│                         │       │     : source-cluster    │
└─────────────────────────┘       └─────────────────────────┘
```

## Header Format

### Standard Headers

| Header | Description | Example |
|--------|-------------|---------|
| `x-kafka-backup-offset` | Original offset in source partition | `12345` |
| `x-kafka-backup-partition` | Original partition number | `0` |
| `x-kafka-backup-cluster` | Source cluster identifier | `prod-us-east-1` |
| `x-kafka-backup-timestamp` | Original record timestamp | `1701234567890` |

### Configuration

Enable offset headers during backup:

```yaml
backup:
  include_offset_headers: true
  source_cluster_id: "prod-us-east-1"
```

Preserve during restore:

```yaml
restore:
  include_original_offset_header: true
```

## Offset Mapping Process

### Building the Mapping

After restore, scan headers to build offset mapping:

```
┌─────────────────────────────────────────────────────────────┐
│                    Offset Mapping Table                      │
├────────────────┬────────────────┬────────────────┬──────────┤
│ Topic          │ Partition      │ Source Offset  │ Target   │
├────────────────┼────────────────┼────────────────┼──────────┤
│ orders         │ 0              │ 12345          │ 100      │
│ orders         │ 0              │ 12346          │ 101      │
│ orders         │ 0              │ 12347          │ 102      │
│ orders         │ 1              │ 5000           │ 50       │
│ orders         │ 1              │ 5001           │ 51       │
│ payments       │ 0              │ 8000           │ 200      │
└────────────────┴────────────────┴────────────────┴──────────┘
```

### Generate Mapping

```bash
kafka-backup show-offset-mapping \
  --bootstrap-servers target-kafka:9092 \
  --topic orders \
  --source-cluster "prod-us-east-1"
```

Output:

```json
{
  "topic": "orders",
  "source_cluster": "prod-us-east-1",
  "mappings": [
    {
      "partition": 0,
      "source_range": {"start": 12345, "end": 15000},
      "target_range": {"start": 100, "end": 2755}
    },
    {
      "partition": 1,
      "source_range": {"start": 5000, "end": 7500},
      "target_range": {"start": 50, "end": 2550}
    }
  ]
}
```

## Consumer Offset Reset

### Reset Strategies

OSO Kafka Backup supports multiple strategies for resetting consumer offsets:

#### 1. Header-Based (Recommended)

Find target offset by scanning for original offset in headers:

```yaml
offset_reset:
  strategy: header-based
  source_cluster: "prod-us-east-1"
```

```
Consumer Group: order-processor
Source Offset: 12345 (topic: orders, partition: 0)

Scan target topic for x-kafka-backup-offset: 12345
  ↓
Found at target offset: 100
  ↓
Reset consumer to offset: 100
```

#### 2. Timestamp-Based

Find target offset by matching record timestamp:

```yaml
offset_reset:
  strategy: timestamp
  timestamp: 1701234567890
```

```
Consumer Group: order-processor
Source Timestamp: 1701234567890

Find first offset >= timestamp
  ↓
Target offset: 100
  ↓
Reset consumer to offset: 100
```

#### 3. Earliest/Latest

Simple reset to beginning or end:

```yaml
offset_reset:
  strategy: earliest  # or: latest
```

#### 4. Specific Offset

Reset to known offset:

```yaml
offset_reset:
  strategy: offset
  offset: 100
```

#### 5. From Mapping File

Use pre-generated mapping:

```yaml
offset_reset:
  strategy: from-mapping
  mapping_file: /path/to/offset-mapping.json
```

### Executing Offset Reset

```bash
# Generate plan
kafka-backup offset-reset plan \
  --config offset-reset.yaml \
  --output reset-plan.json

# Review plan
cat reset-plan.json

# Execute
kafka-backup offset-reset execute \
  --plan reset-plan.json \
  --bootstrap-servers target-kafka:9092
```

## Three-Phase Restore

For complete restoration including consumer offsets:

```
Phase 1: Data Restore
┌─────────────────────────────────────────┐
│ Restore messages to target cluster      │
│ Include offset headers                  │
└─────────────────────────────────────────┘
                    │
                    ▼
Phase 2: Build Mapping
┌─────────────────────────────────────────┐
│ Scan restored topics                    │
│ Build source→target offset mapping      │
└─────────────────────────────────────────┘
                    │
                    ▼
Phase 3: Reset Offsets
┌─────────────────────────────────────────┐
│ For each consumer group:                │
│   Look up source offset                 │
│   Find corresponding target offset      │
│   Reset consumer group                  │
└─────────────────────────────────────────┘
```

Execute with single command:

```bash
kafka-backup three-phase-restore --config restore.yaml
```

## Handling Edge Cases

### Offset Gaps

When source offsets have gaps (compaction, deletion):

```
Source: 100, 101, 105, 106, 110  (gaps at 102-104, 107-109)
Target: 0, 1, 2, 3, 4            (contiguous)

Mapping:
  Source 100 → Target 0
  Source 101 → Target 1
  Source 105 → Target 2  (gap handled)
  Source 106 → Target 3
  Source 110 → Target 4
```

The mapping correctly handles gaps by using the actual records present.

### Compacted Topics

For compacted topics where messages are removed:

```yaml
backup:
  include_offset_headers: true
  # Headers survive compaction if key remains
```

Consumer reset uses the most recent offset for each key:

```
If consumer was at offset 100 (key: A)
But key A was compacted to offset 200 in source
Then find the record with key A in target
Reset to that offset
```

### Partition Count Changes

When target has different partition count:

```
Source: 3 partitions
Target: 6 partitions

Original message in partition 1, offset 500
May land in different partition due to repartitioning

Solution: Include partition in header
Scan ALL partitions in target for matching header
```

Configuration:

```yaml
restore:
  # Records may be in different partitions
  include_original_offset_header: true

offset_reset:
  strategy: header-based
  scan_all_partitions: true  # Required for partition changes
```

### Topic Remapping

When topics are renamed during restore:

```yaml
restore:
  topic_mapping:
    orders: production-orders
    payments: production-payments
```

The offset mapping tracks both:

```json
{
  "source_topic": "orders",
  "target_topic": "production-orders",
  "source_cluster": "prod-us-east-1",
  "mappings": [...]
}
```

## Performance Considerations

### Header Scanning Performance

Scanning headers for offset mapping can be slow for large topics:

```yaml
offset_reset:
  strategy: header-based

  # Performance tuning
  parallel_consumers: 10      # Parallel partition scanning
  sample_rate: 1.0           # 1.0 = scan all, 0.1 = 10% sample
  timeout_secs: 3600         # Max scan time
```

### Bulk Offset Reset

For many consumer groups, use bulk reset:

```bash
kafka-backup offset-reset-bulk \
  --config offset-reset.yaml \
  --groups-file consumer-groups.txt \
  --parallelism 50
```

This provides up to 50x speedup for large numbers of consumer groups.

### Caching

Offset mapping can be cached for repeated use:

```bash
# Generate and save mapping
kafka-backup show-offset-mapping \
  --bootstrap-servers kafka:9092 \
  --all-topics \
  --source-cluster "prod" \
  --output mapping.json

# Use cached mapping for multiple resets
kafka-backup offset-reset execute \
  --strategy from-mapping \
  --mapping-file mapping.json \
  --groups group1,group2,group3
```

## Verification

### Verify Offset Reset

After resetting offsets:

```bash
# Check consumer group positions
kafka-consumer-groups \
  --bootstrap-server target-kafka:9092 \
  --group order-processor \
  --describe
```

### Verify Data Continuity

Ensure consumers will process correct messages:

```bash
# Show what message consumer will receive next
kafka-console-consumer \
  --bootstrap-server target-kafka:9092 \
  --topic orders \
  --partition 0 \
  --offset 100 \
  --max-messages 1 \
  --property print.headers=true
```

Check the `x-kafka-backup-offset` header matches expected source offset.

## Best Practices

1. **Always enable offset headers** during backup
2. **Use three-phase restore** for complete migrations
3. **Test offset reset** in non-production first
4. **Take offset snapshots** before resetting (rollback capability)
5. **Verify consumer positions** after reset

## Next Steps

- [PITR Implementation](./pitr-implementation) - How time filtering affects offsets
- [Offset Management Guide](../guides/offset-management) - Practical offset operations
- [Three-Phase Restore](../reference/cli-reference#three-phase-restore) - CLI reference
