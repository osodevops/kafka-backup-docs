---
title: Point-in-Time Recovery
description: Restore Kafka data to a specific point in time using PITR
sidebar_position: 2
---

# Point-in-Time Recovery (PITR)

Restore Kafka data to any specific moment within your backup window with millisecond precision.

## What is PITR?

Point-in-Time Recovery allows you to restore data from a backup to a specific timestamp, rather than restoring the entire backup. This is useful for:

- **Disaster recovery**: Restore to just before a data corruption event
- **Debugging**: Reproduce issues with data from a specific time
- **Compliance**: Retrieve data as it existed at a particular moment
- **Testing**: Create test environments with data from specific periods

## Prerequisites

- Backup created with `include_offset_headers: true`
- Backup storage accessible
- Target Kafka cluster available

## Understanding Time Windows

When you back up Kafka topics, each message includes its original timestamp. PITR uses these timestamps to filter which messages to restore.

```
Backup Timeline:
├── Nov 1, 00:00 ─ Backup started
│   ├── Message 1 (timestamp: Nov 1, 00:00:01)
│   ├── Message 2 (timestamp: Nov 1, 00:00:02)
│   ├── ...
│   ├── Message N (timestamp: Nov 15, 23:59:59)
└── Nov 15, 23:59 ─ Backup ended

PITR Window: Nov 10, 10:00 → Nov 10, 14:00
Result: Only messages with timestamps in this 4-hour window are restored
```

## Step 1: Find Available Time Range

First, check the time range available in your backup:

```bash
kafka-backup describe \
  --path s3://my-kafka-backups/production \
  --backup-id production-backup-001
```

Output:

```
Backup: production-backup-001
═══════════════════════════════════════

Time Range:
  Earliest Message:  2024-11-01T00:00:00Z
  Latest Message:    2024-11-15T23:59:59Z

Topics:
  orders       6 partitions    523,456 records
  payments     3 partitions    234,567 records
```

## Step 2: Convert Timestamps

PITR uses Unix timestamps in **milliseconds**. Convert your target times:

### Using Linux/macOS

```bash
# Convert ISO timestamp to Unix milliseconds
date -d "2024-11-10T10:00:00Z" +%s000
# Output: 1731236400000

date -d "2024-11-10T14:00:00Z" +%s000
# Output: 1731250800000
```

### Using Python

```python
from datetime import datetime

start = datetime(2024, 11, 10, 10, 0, 0)
end = datetime(2024, 11, 10, 14, 0, 0)

print(f"Start: {int(start.timestamp() * 1000)}")
print(f"End: {int(end.timestamp() * 1000)}")
```

### Common Time Windows

| Window | Start Formula | Example |
|--------|---------------|---------|
| Last hour | `now - 3600000` | Debugging recent issues |
| Last 24 hours | `now - 86400000` | Daily incident recovery |
| Specific day | Midnight to midnight | Compliance reporting |

## Step 3: Create PITR Configuration

```yaml title="pitr-restore.yaml"
mode: restore
backup_id: "production-backup-001"

target:
  bootstrap_servers:
    - kafka-dr-0.example.com:9092
    - kafka-dr-1.example.com:9092

storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  prefix: production

restore:
  # Point-in-Time Recovery window
  time_window_start: 1731236400000  # Nov 10, 2024 10:00:00 UTC
  time_window_end: 1731250800000    # Nov 10, 2024 14:00:00 UTC

  # Optional: Only restore specific topics
  # topics:
  #   - orders
  #   - payments

  # Optional: Remap topic names
  topic_mapping:
    orders: orders_pitr_restore
    payments: payments_pitr_restore

  # Include original offset in headers for consumer reset
  include_original_offset_header: true

  # Consumer offset handling
  consumer_group_strategy: skip
```

## Step 4: Validate Before Restore

Always validate PITR configuration first:

```bash
kafka-backup validate-restore --config pitr-restore.yaml
```

Output:

```
Restore Validation Report
═══════════════════════════════════════

Status: ✓ VALID

PITR Time Window:
  Start: 2024-11-10T10:00:00Z (1731236400000)
  End:   2024-11-10T14:00:00Z (1731250800000)
  Duration: 4 hours

Data to Restore:
  Segments matching: 23 of 156
  Records in window: ~45,678
  Estimated size: 12.3 MB

Topics:
  orders   → orders_pitr_restore    (est. 23,456 records)
  payments → payments_pitr_restore  (est. 22,222 records)
```

## Step 5: Execute PITR Restore

```bash
kafka-backup restore --config pitr-restore.yaml
```

Output:

```
[INFO] Starting PITR restore from: production-backup-001
[INFO] Time window: 2024-11-10T10:00:00Z to 2024-11-10T14:00:00Z
[INFO] Filtering records by timestamp...

[INFO] Restoring topic: orders → orders_pitr_restore
  Records in window: 23,456
  Restoring partition 0: 3,892 records
  Restoring partition 1: 3,901 records
  ...

[INFO] PITR restore completed
[INFO] Summary:
  Records Restored: 45,678
  Skipped (outside window): 477,889
  Duration: 2m 15s
```

## Step 6: Verify Restored Data

```bash
# Check topic was created
kafka-topics --bootstrap-server kafka-dr:9092 --describe --topic orders_pitr_restore

# Sample messages
kafka-console-consumer \
  --bootstrap-server kafka-dr:9092 \
  --topic orders_pitr_restore \
  --from-beginning \
  --max-messages 5 \
  --property print.timestamp=true
```

## Advanced PITR Scenarios

### Restore to "Just Before" an Incident

If you know an incident occurred at 14:32:15 UTC:

```yaml
restore:
  # Restore up to 1 minute before the incident
  time_window_end: 1731251535000  # 14:32:15 - 60000 = 14:31:15
```

### Restore Specific Partitions Only

```yaml
restore:
  time_window_start: 1731236400000
  time_window_end: 1731250800000
  source_partitions:
    - 0
    - 1
    - 2  # Only restore partitions 0, 1, 2
```

### Restore with Partition Remapping

```yaml
restore:
  time_window_start: 1731236400000
  time_window_end: 1731250800000
  partition_mapping:
    0: 0
    1: 0  # Merge partition 1 into partition 0
    2: 1  # Move partition 2 to partition 1
```

### Continuous Time Window (Open-Ended)

```yaml
restore:
  # From Nov 10 to latest available
  time_window_start: 1731236400000
  # time_window_end: omitted = restore to end of backup
```

## Consumer Offset Handling After PITR

After a PITR restore, consumer groups need their offsets adjusted. Since only a subset of messages is restored, offsets will differ.

### Option 1: Reset to Earliest

```bash
kafka-consumer-groups \
  --bootstrap-server kafka-dr:9092 \
  --group my-consumer-group \
  --topic orders_pitr_restore \
  --reset-offsets \
  --to-earliest \
  --execute
```

### Option 2: Use Offset Headers

If `include_original_offset_header: true` was set, messages contain their original offsets. Consumers can read this header to track position.

### Option 3: Three-Phase Restore

Use the three-phase restore for automatic offset handling:

```yaml
restore:
  time_window_start: 1731236400000
  time_window_end: 1731250800000
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - my-consumer-group
```

```bash
kafka-backup three-phase-restore --config pitr-restore.yaml
```

## Performance Considerations

PITR may be slower than full restore because:

1. All segments must be scanned to find matching records
2. Filtering adds CPU overhead
3. Smaller batches may be written

### Optimization Tips

- Use narrower time windows when possible
- Increase `max_concurrent_partitions` for parallelism
- Use faster storage (SSD) for backup data

## Troubleshooting

### No Records in Time Window

```
Warning: No records found in specified time window
```

**Causes:**
- Time window is outside backup range
- Timestamps are in wrong format (seconds vs milliseconds)
- Topic has no data in that period

**Solution:** Check backup time range with `describe` command.

### Timestamp Mismatch

Messages may have unexpected timestamps if:
- Producers set custom timestamps
- Messages were replicated with different timestamps
- Clock skew between producers

## Best Practices

1. **Always validate first** - Use `validate-restore` before executing
2. **Restore to new topics** - Use `topic_mapping` to avoid overwriting
3. **Document recovery points** - Note important timestamps for compliance
4. **Test regularly** - Practice PITR restores before you need them
5. **Monitor backup timestamps** - Ensure backups capture expected time ranges

## Next Steps

- [Offset Management](./offset-management) - Handle consumer offsets after restore
- [Three-Phase Restore](../reference/cli-reference#three-phase-restore) - Automated restore with offset reset
- [Disaster Recovery Use Case](../use-cases/disaster-recovery) - DR planning with PITR
