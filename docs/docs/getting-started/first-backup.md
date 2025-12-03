---
title: First Backup Tutorial
description: Complete step-by-step guide to backing up and restoring your first Kafka topic
sidebar_position: 4
---

# Your First Backup

This tutorial walks you through a complete backup and restore cycle, explaining each step in detail.

## What You'll Learn

- How to create a backup configuration
- How to run a backup operation
- How to verify backup integrity
- How to restore from backup
- How to handle consumer group offsets

## Prerequisites

- OSO Kafka Backup installed ([Installation Guide](../deployment))
- Access to a Kafka cluster
- Storage location (local path or cloud bucket)

## Step 1: Plan Your Backup

Before creating a backup, decide:

1. **Which topics to back up?** You can use explicit names or patterns
2. **Where to store backups?** Local filesystem, S3, Azure, or GCS
3. **What compression to use?** Zstd (best ratio), LZ4 (fastest), or none
4. **Starting offset?** From earliest (full backup) or latest (incremental)

## Step 2: Create the Backup Configuration

Create a file named `backup.yaml`:

```yaml title="backup.yaml"
# Backup mode
mode: backup

# Unique identifier for this backup
backup_id: "production-backup-001"

# Source Kafka cluster
source:
  bootstrap_servers:
    - broker-1.kafka.svc:9092
    - broker-2.kafka.svc:9092
    - broker-3.kafka.svc:9092

  # Optional: Security configuration
  # security:
  #   security_protocol: SASL_SSL
  #   sasl_mechanism: SCRAM-SHA-256
  #   sasl_username: backup-user
  #   sasl_password: ${KAFKA_PASSWORD}  # Environment variable

  # Topics to back up
  topics:
    include:
      - orders           # Explicit topic name
      - payments         # Another topic
      - "events-*"       # Wildcard pattern
    exclude:
      - "__consumer_offsets"  # Internal topics
      - "_schemas"            # Schema registry topic

# Storage destination
storage:
  backend: filesystem    # Options: filesystem, s3, azure, gcs
  path: "/var/lib/kafka-backup/data"
  # For S3:
  # backend: s3
  # bucket: my-backup-bucket
  # region: us-west-2
  # prefix: kafka-backups/production

# Backup settings
backup:
  # Compression
  compression: zstd      # Options: zstd, lz4, none
  compression_level: 3   # 1-22 for zstd (higher = better ratio, slower)

  # Starting point
  start_offset: earliest # Options: earliest, latest

  # Segment settings
  segment_max_bytes: 134217728    # 128 MB per segment
  segment_max_interval_ms: 60000  # Force segment roll every 60s

  # Checkpointing for resumable backups
  checkpoint_interval_secs: 30

  # Include offset headers (required for offset reset)
  include_offset_headers: true

  # Source cluster identifier (for tracking)
  source_cluster_id: "production-cluster"
```

### Configuration Explained

| Setting | Purpose |
|---------|---------|
| `backup_id` | Unique name for this backup; used for restore |
| `bootstrap_servers` | Kafka broker addresses |
| `topics.include` | Topics to back up (names or patterns) |
| `topics.exclude` | Topics to skip |
| `compression` | Reduce storage size and costs |
| `start_offset: earliest` | Back up all data from beginning |
| `checkpoint_interval_secs` | How often to save progress |
| `include_offset_headers` | Store original offsets for consumer reset |

## Step 3: Run the Backup

Execute the backup:

```bash
kafka-backup backup --config backup.yaml
```

With verbose logging:

```bash
kafka-backup -v backup --config backup.yaml
```

### Expected Output

```
[2024-12-03T10:00:00Z INFO] Starting backup: production-backup-001
[2024-12-03T10:00:00Z INFO] Connecting to Kafka cluster...
[2024-12-03T10:00:01Z INFO] Connected to cluster: production-cluster
[2024-12-03T10:00:01Z INFO] Discovered topics matching patterns:
  - orders (6 partitions)
  - payments (3 partitions)
  - events-clickstream (12 partitions)
  - events-pageviews (12 partitions)

[2024-12-03T10:00:02Z INFO] Starting backup of 4 topics, 33 partitions
[2024-12-03T10:00:02Z INFO] Topic: orders
  Partition 0: 150,234 records (earliest: 0, latest: 150233)
  Partition 1: 148,892 records
  ...

[2024-12-03T10:05:32Z INFO] Backup completed successfully
[2024-12-03T10:05:32Z INFO] Summary:
  Topics: 4
  Partitions: 33
  Records: 2,456,789
  Uncompressed: 1.2 GB
  Compressed: 245 MB
  Compression ratio: 4.9x
  Duration: 5m 30s
  Throughput: 7,445 records/sec
```

## Step 4: Verify the Backup

### List Backups

```bash
kafka-backup list --path /var/lib/kafka-backup/data
```

```
Available Backups:
─────────────────────────────────────────────────────────────
  production-backup-001
    Created:     2024-12-03T10:00:00Z
    Source:      production-cluster
    Topics:      4
    Partitions:  33
    Records:     2,456,789
    Size:        245 MB (compressed)
─────────────────────────────────────────────────────────────
```

### Get Detailed Information

```bash
kafka-backup describe --path /var/lib/kafka-backup/data --backup-id production-backup-001
```

```
Backup: production-backup-001
════════════════════════════════════════════════════════════

Metadata:
  Created:           2024-12-03T10:00:00Z
  Source Cluster:    production-cluster
  Compression:       zstd (level 3)

Statistics:
  Topics:            4
  Partitions:        33
  Segments:          156
  Records:           2,456,789
  Uncompressed:      1.2 GB
  Compressed:        245 MB
  Compression Ratio: 4.9x

Time Range:
  Earliest Message:  2024-11-01T00:00:00Z
  Latest Message:    2024-12-03T09:59:59Z

Topics:
  orders           6 partitions    523,456 records
  payments         3 partitions    234,567 records
  events-click    12 partitions    890,123 records
  events-pages    12 partitions    808,643 records
```

### Validate Integrity

```bash
# Quick validation
kafka-backup validate --path /var/lib/kafka-backup/data --backup-id production-backup-001

# Deep validation (reads all data)
kafka-backup validate --path /var/lib/kafka-backup/data --backup-id production-backup-001 --deep
```

```
Validation Report: production-backup-001
════════════════════════════════════════════════════════════

Segments:
  Checked:    156
  Valid:      156
  Missing:    0
  Corrupted:  0

Records Validated: 2,456,789

Result: ✓ VALID
```

## Step 5: Create a Restore Configuration

Create `restore.yaml`:

```yaml title="restore.yaml"
mode: restore
backup_id: "production-backup-001"

# Target Kafka cluster (can be different from source)
target:
  bootstrap_servers:
    - dr-broker-1.kafka.svc:9092
    - dr-broker-2.kafka.svc:9092

storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"

restore:
  # Optional: Point-in-time recovery
  # time_window_start: 1701417600000  # Unix ms timestamp
  # time_window_end: 1701504000000

  # Optional: Topic remapping
  # topic_mapping:
  #   orders: orders_restored
  #   payments: payments_dr

  # Consumer offset handling
  consumer_group_strategy: skip  # Options: skip, header-based, manual

  # Include original offset in headers (for manual consumer reset)
  include_original_offset_header: true

  # Dry run first to validate
  dry_run: false
```

## Step 6: Validate Before Restore

Always validate a restore configuration before executing:

```bash
kafka-backup validate-restore --config restore.yaml
```

```
Restore Validation Report
════════════════════════════════════════════════════════════

Status: ✓ VALID

Backup:
  ID: production-backup-001
  Source: production-cluster

Target Cluster:
  Brokers: dr-broker-1.kafka.svc:9092, dr-broker-2.kafka.svc:9092
  Connection: ✓ OK

Topics to Restore:
  orders      → orders      (6 partitions)
  payments    → payments    (3 partitions)
  events-*    → events-*    (24 partitions)

Data:
  Segments: 156
  Records: 2,456,789
  Estimated Size: 1.2 GB (uncompressed)

Warnings:
  - Topic 'orders' exists on target with 6 partitions (will append data)
```

## Step 7: Execute the Restore

```bash
kafka-backup restore --config restore.yaml
```

```
[2024-12-03T11:00:00Z INFO] Starting restore from: production-backup-001
[2024-12-03T11:00:01Z INFO] Connected to target cluster
[2024-12-03T11:00:02Z INFO] Restoring 4 topics, 33 partitions

[2024-12-03T11:00:02Z INFO] Topic: orders
  Partition 0: Restoring 150,234 records...
  Partition 0: ✓ Complete
  ...

[2024-12-03T11:08:45Z INFO] Restore completed successfully
[2024-12-03T11:08:45Z INFO] Summary:
  Records Restored: 2,456,789
  Duration: 8m 43s
  Throughput: 4,698 records/sec
```

## Step 8: Handle Consumer Offsets

After restore, consumer groups need their offsets updated. There are several strategies:

### Option A: Manual Reset Using Kafka Tools

```bash
# View offset mapping from backup
kafka-backup show-offset-mapping \
  --path /var/lib/kafka-backup/data \
  --backup-id production-backup-001 \
  --format text
```

```
Offset Mapping: production-backup-001
─────────────────────────────────────────────────────────────
Topic       Partition  Source Start  Source End  Records
─────────────────────────────────────────────────────────────
orders      0          0             150233      150234
orders      1          0             148891      148892
payments    0          0             78234       78235
...

To reset consumer groups, use:
kafka-consumer-groups --bootstrap-server <broker> \
  --group <group-name> \
  --topic orders:0 \
  --reset-offsets --to-offset 150233 --execute
```

### Option B: Automated Reset with Kafka Backup

```bash
# Generate a reset plan
kafka-backup offset-reset plan \
  --path /var/lib/kafka-backup/data \
  --backup-id production-backup-001 \
  --groups my-consumer-group,analytics-group \
  --bootstrap-servers dr-broker-1:9092

# Execute the reset
kafka-backup offset-reset execute \
  --path /var/lib/kafka-backup/data \
  --backup-id production-backup-001 \
  --groups my-consumer-group \
  --bootstrap-servers dr-broker-1:9092
```

### Option C: Three-Phase Restore (All-in-One)

For disaster recovery, use the three-phase restore which handles everything:

```yaml title="dr-restore.yaml"
mode: restore
backup_id: "production-backup-001"

target:
  bootstrap_servers:
    - dr-broker-1:9092

storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"

restore:
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - my-consumer-group
    - analytics-group
```

```bash
kafka-backup three-phase-restore --config dr-restore.yaml
```

## Summary

You've learned how to:

1. **Create a backup configuration** with topic selection, compression, and checkpointing
2. **Execute and monitor a backup** operation
3. **Verify backup integrity** with validation commands
4. **Plan and execute a restore** with optional PITR
5. **Handle consumer group offsets** after restore

## Next Steps

- **[Backup to S3](../guides/backup-to-s3)** - Store backups in cloud storage
- **[Point-in-Time Recovery](../guides/restore-pitr)** - Restore to specific timestamps
- **[Offset Management](../guides/offset-management)** - Advanced consumer offset handling
- **[Performance Tuning](../guides/performance-tuning)** - Optimize throughput
- **[Kubernetes Operator](../operator)** - Automated scheduled backups
