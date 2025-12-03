---
title: PITR Implementation
description: How point-in-time recovery works in OSO Kafka Backup
sidebar_position: 3
---

# Point-in-Time Recovery Implementation

OSO Kafka Backup provides millisecond-precision point-in-time recovery (PITR), allowing you to restore Kafka data to any specific moment.

## How PITR Works

### Timestamp-Based Filtering

Every Kafka record has a timestamp. PITR uses these timestamps to filter which records are restored:

```
Backup Contains Records:
┌──────────────────────────────────────────────────────────────┐
│ T=1000  T=1001  T=1002  T=1003  T=1004  T=1005  T=1006      │
│   │       │       │       │       │       │       │         │
│   ▼       ▼       ▼       ▼       ▼       ▼       ▼         │
│ ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐      │
│ │ A │   │ B │   │ C │   │ D │   │ E │   │ F │   │ G │      │
│ └───┘   └───┘   └───┘   └───┘   └───┘   └───┘   └───┘      │
└──────────────────────────────────────────────────────────────┘

PITR Request: time_window_start=1002, time_window_end=1005

Restored Records:
┌──────────────────────────────────────────────────────────────┐
│                   T=1002  T=1003  T=1004  T=1005             │
│                     │       │       │       │               │
│                     ▼       ▼       ▼       ▼               │
│                   ┌───┐   ┌───┐   ┌───┐   ┌───┐             │
│                   │ C │   │ D │   │ E │   │ F │             │
│                   └───┘   └───┘   └───┘   └───┘             │
└──────────────────────────────────────────────────────────────┘
```

### Timestamp Types

Kafka records have two timestamp types:

| Type | Description | When Set |
|------|-------------|----------|
| `CreateTime` | When producer created the record | Producer-side |
| `LogAppendTime` | When broker received the record | Broker-side |

PITR filters based on the record's actual timestamp, regardless of type.

## Configuration

### Basic PITR Restore

```yaml
mode: restore
backup_id: "production-backup-20241201"

restore:
  # Unix timestamp in milliseconds
  time_window_start: 1701388800000  # Dec 1, 2024 00:00:00 UTC
  time_window_end: 1701475199000    # Dec 1, 2024 23:59:59 UTC
```

### Using ISO 8601 Format

The CLI accepts human-readable timestamps:

```bash
kafka-backup restore \
  --config restore.yaml \
  --time-start "2024-12-01T00:00:00Z" \
  --time-end "2024-12-01T23:59:59Z"
```

### Restore to Specific Point

Restore everything up to a specific moment:

```yaml
restore:
  time_window_end: 1701450000000  # Stop at this point
  # Omit time_window_start to include all earlier records
```

### Restore from Specific Point

Restore everything after a specific moment:

```yaml
restore:
  time_window_start: 1701450000000  # Start from this point
  # Omit time_window_end to include all later records
```

## Implementation Details

### Segment-Level Filtering

Backups are stored in segment files with time ranges:

```
backup/
├── manifest.json
└── segments/
    ├── segment-0000.dat   # T: 1000-2000
    ├── segment-0001.dat   # T: 2001-3000
    ├── segment-0002.dat   # T: 3001-4000
    └── segment-0003.dat   # T: 4001-5000

PITR Request: T: 2500-3500

Segments to read:
  ✗ segment-0000.dat  (T: 1000-2000) - Skip entirely
  ✓ segment-0001.dat  (T: 2001-3000) - Read, filter records
  ✓ segment-0002.dat  (T: 3001-4000) - Read, filter records
  ✗ segment-0003.dat  (T: 4001-5000) - Skip entirely
```

This segment-level filtering significantly improves performance.

### Record-Level Filtering

Within each segment, individual records are filtered:

```rust
// Pseudocode for record filtering
for record in segment.records() {
    let timestamp = record.timestamp();

    if let Some(start) = time_window_start {
        if timestamp < start {
            continue;  // Skip record before window
        }
    }

    if let Some(end) = time_window_end {
        if timestamp > end {
            continue;  // Skip record after window
        }
    }

    // Record is within window
    output.write(record);
}
```

### Manifest Time Ranges

The backup manifest tracks time ranges for efficient filtering:

```json
{
  "backup_id": "production-backup-20241201",
  "topics": {
    "orders": {
      "partitions": {
        "0": {
          "segment_files": [
            {
              "file": "orders-0-0000.dat",
              "start_offset": 0,
              "end_offset": 9999,
              "start_timestamp": 1701388800000,
              "end_timestamp": 1701392400000,
              "record_count": 10000
            },
            {
              "file": "orders-0-0001.dat",
              "start_offset": 10000,
              "end_offset": 19999,
              "start_timestamp": 1701392400001,
              "end_timestamp": 1701396000000,
              "record_count": 10000
            }
          ]
        }
      }
    }
  }
}
```

## Per-Topic Time Windows

Different topics can have different recovery points:

```yaml
restore:
  topics:
    - name: orders
      time_window_start: 1701388800000
      time_window_end: 1701475199000

    - name: payments
      time_window_start: 1701400000000  # Different start
      time_window_end: 1701475199000

    - name: audit-log
      # No time window - restore everything
```

## PITR Use Cases

### Scenario 1: Data Corruption Recovery

Bad data published at 14:30:00, restore to 14:29:59:

```yaml
restore:
  # Restore everything before the corruption
  time_window_end: 1701437399000  # 14:29:59
```

### Scenario 2: Incident Investigation

Investigate data between 10:00 and 11:00:

```yaml
restore:
  time_window_start: 1701421200000  # 10:00:00
  time_window_end: 1701424800000    # 11:00:00

  # Restore to investigation cluster
  topic_mapping:
    orders: investigation-orders
```

### Scenario 3: Regulatory Audit

Provide data as it existed on a specific date:

```yaml
restore:
  # Full day - Dec 1, 2024
  time_window_start: 1701388800000  # 00:00:00 UTC
  time_window_end: 1701475199999    # 23:59:59.999 UTC
```

### Scenario 4: Rolling Back a Release

Restore data to state before deployment:

```yaml
restore:
  # Deployment started at 15:00
  time_window_end: 1701442800000  # 14:59:59

  # Only restore affected topics
  topics:
    - user-events
    - notifications
```

## Timestamp Considerations

### Producer Timestamp Accuracy

For accurate PITR, ensure producers set correct timestamps:

```java
// Java producer example
ProducerRecord<String, String> record = new ProducerRecord<>(
    "orders",
    null,                           // partition
    System.currentTimeMillis(),     // timestamp - set explicitly
    key,
    value
);
```

### Clock Skew

If producer clocks are skewed, PITR may not work as expected:

```
Producer A (clock +5 minutes): Record timestamp = 10:05
Producer B (clock correct):    Record timestamp = 10:00
Actual time:                   10:00

PITR restore to 10:02 would:
  ✓ Include record from Producer B (10:00)
  ✗ Exclude record from Producer A (10:05) - even though it was "really" at 10:00
```

**Mitigation:**
- Use NTP synchronization on all producers
- Consider using `LogAppendTime` for broker-controlled timestamps

### LogAppendTime Configuration

Configure topics to use broker timestamp:

```bash
kafka-configs --bootstrap-server kafka:9092 \
  --entity-type topics --entity-name orders \
  --alter --add-config message.timestamp.type=LogAppendTime
```

## Performance Optimization

### Time-Based Segment Selection

PITR avoids reading unnecessary segments:

```
Backup: 100 segments (10 GB each = 1 TB total)
PITR Window: 1 hour

Segments in window: 4 segments (40 GB)
Segments skipped: 96 segments (960 GB)

I/O saved: 96%
```

### Streaming Filter

Records are filtered during streaming, not post-processing:

```
Storage → Read → Filter → Decompress → Write to Kafka
                   ↓
            Skip early (no decompression overhead)
```

### Parallel Partition Processing

Each partition is processed in parallel with independent time filtering:

```
Partition 0: Filter T=1000-2000 ─────────────┐
Partition 1: Filter T=1000-2000 ─────────────┼──▶ Target Cluster
Partition 2: Filter T=1000-2000 ─────────────┘
```

## Verification

### Verify Time Range

After PITR restore, verify the time range:

```bash
# Check earliest message
kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic orders \
  --from-beginning \
  --max-messages 1 \
  --property print.timestamp=true

# Check latest message
kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list kafka:9092 \
  --topic orders \
  --time -1
```

### Describe Backup Time Range

```bash
kafka-backup describe \
  --path s3://bucket/backups \
  --backup-id production-20241201 \
  --format json | jq '.time_range'
```

Output:

```json
{
  "earliest_timestamp": 1701388800000,
  "latest_timestamp": 1701475199999,
  "earliest_timestamp_iso": "2024-12-01T00:00:00Z",
  "latest_timestamp_iso": "2024-12-01T23:59:59.999Z"
}
```

## Limitations

### Timestamp Resolution

- Kafka timestamps are millisecond precision
- PITR is also millisecond precision
- Sub-millisecond ordering is not guaranteed

### No Transaction Boundaries

PITR filters by timestamp, not transaction boundaries:

```
Transaction: Records A, B, C (all at T=1000)
PITR end: T=999

Result: Transaction partially restored (none of A, B, C)
```

If transaction integrity is required, ensure time windows align with transaction boundaries.

### Compacted Topics

For compacted topics, PITR works on the backup data:

```
Backup contains: All records at backup time
PITR restores: Subset by timestamp

Note: Compaction state differs from source
```

## Best Practices

1. **Use consistent time sources** - NTP synchronization
2. **Document time zones** - Use UTC for clarity
3. **Test PITR regularly** - Verify recovery works
4. **Include buffer time** - Add a few seconds margin
5. **Verify after restore** - Check time ranges match

## Next Steps

- [Offset Translation](./offset-translation) - Consumer offset handling with PITR
- [Restore PITR Guide](../guides/restore-pitr) - Practical PITR operations
- [CLI Reference](../reference/cli-reference#restore) - Restore command options
