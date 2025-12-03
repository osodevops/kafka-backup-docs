---
title: CLI Reference
description: Complete reference for all OSO Kafka Backup CLI commands, flags, and options
sidebar_position: 1
---

# CLI Reference

Complete reference documentation for all OSO Kafka Backup CLI commands.

## Global Options

These options apply to all commands:

```bash
kafka-backup [OPTIONS] <COMMAND>
```

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Enable verbose logging. Use `-v` for debug, `-vv` for trace |
| `-h, --help` | Print help information |
| `-V, --version` | Print version information |

---

## backup

Run a backup operation from a Kafka cluster to storage.

```bash
kafka-backup backup --config <PATH>
```

### Options

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-c, --config` | PATH | Yes | Path to backup configuration YAML |

### Examples

```bash
# Basic backup
kafka-backup backup --config backup.yaml

# With debug logging
kafka-backup -v backup --config /etc/kafka-backup/production.yaml

# With trace logging
kafka-backup -vv backup --config backup.yaml
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Backup completed successfully |
| 1 | Backup failed |

---

## restore

Restore data from a backup to a Kafka cluster.

```bash
kafka-backup restore --config <PATH>
```

### Options

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-c, --config` | PATH | Yes | Path to restore configuration YAML |

### Examples

```bash
# Basic restore
kafka-backup restore --config restore.yaml

# Restore with verbose output
kafka-backup -v restore --config dr-restore.yaml
```

---

## list

List available backups or show details of a specific backup.

```bash
kafka-backup list --path <PATH> [--backup-id <ID>]
```

### Options

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | PATH | Yes | Path to storage location (local path or S3 URI) |
| `-b, --backup-id` | STRING | No | Specific backup ID to show details for |

### Examples

```bash
# List all backups in local storage
kafka-backup list --path /var/lib/kafka-backup/data

# List backups in S3
kafka-backup list --path s3://my-bucket/backups

# Show details for a specific backup
kafka-backup list --path /data --backup-id daily-backup-001
```

### Output

```
Available Backups:
─────────────────────────────────────────────────────────────
  daily-backup-001
    Created: 2024-12-03T02:00:00Z
    Topics: 5
    Records: 1,234,567
    Size: 128 MB (compressed)
─────────────────────────────────────────────────────────────
```

---

## status

Show status and statistics of a backup job.

```bash
kafka-backup status --path <PATH> --backup-id <ID> [--db-path <PATH>]
```

### Options

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | PATH | Yes | Path to storage location |
| `-b, --backup-id` | STRING | Yes | Backup ID to show status for |
| `--db-path` | PATH | No | Path to offset database (for tracking progress) |

### Examples

```bash
kafka-backup status --path /data --backup-id backup-001

kafka-backup status -p /data -b backup-001 --db-path /var/lib/kafka-backup/offsets.db
```

### Output Information

- Manifest information (created date, source cluster)
- Topic/partition/segment counts
- Record and size statistics (compressed and uncompressed)
- Compression ratio
- Offset tracking status per partition

---

## describe

Show detailed backup manifest information.

```bash
kafka-backup describe --path <PATH> --backup-id <ID> [--format <FORMAT>]
```

### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-p, --path` | PATH | Yes | - | Path to storage location |
| `-b, --backup-id` | STRING | Yes | - | Backup ID to describe |
| `-f, --format` | STRING | No | text | Output format: `text`, `json`, `yaml` |

### Examples

```bash
# Human-readable output
kafka-backup describe --path /data --backup-id backup-001

# JSON for scripting
kafka-backup describe -p /data -b backup-001 --format json

# YAML output
kafka-backup describe -p /data -b backup-001 -f yaml
```

### Output Information

- Backup ID and creation timestamp
- Source cluster ID and brokers
- Compression algorithm
- Topic/partition/segment/record counts
- Compressed and uncompressed sizes
- Compression ratio
- Time range of backed-up data
- Per-topic and per-partition details

---

## validate

Validate backup integrity.

```bash
kafka-backup validate --path <PATH> --backup-id <ID> [--deep]
```

### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-p, --path` | PATH | Yes | - | Path to storage location |
| `-b, --backup-id` | STRING | Yes | - | Backup ID to validate |
| `--deep` | BOOL | No | false | Perform deep validation (read and verify each segment) |

### Examples

```bash
# Shallow validation (quick - checks existence and metadata)
kafka-backup validate --path /data --backup-id backup-001

# Deep validation (thorough - reads and parses all segments)
kafka-backup validate -p /data -b backup-001 --deep
```

### Validation Report

```
Validation Report: backup-001
════════════════════════════════════════════════════════════

Segments:
  Checked:    156
  Valid:      156
  Missing:    0
  Corrupted:  0

Records Validated: 2,456,789

Issues Found: 0

Result: ✓ VALID
```

---

## validate-restore

Validate a restore configuration without executing it.

```bash
kafka-backup validate-restore --config <PATH> [--format <FORMAT>]
```

### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-c, --config` | PATH | Yes | - | Path to restore configuration file |
| `-f, --format` | STRING | No | text | Output format: `text`, `json`, `yaml` |

### Examples

```bash
# Validate restore config
kafka-backup validate-restore --config restore.yaml

# Get JSON report for CI/CD
kafka-backup validate-restore -c restore.yaml --format json
```

### Report Contents

- Restore status (VALID or INVALID)
- Topics to restore (count and names)
- Segments to process
- Records and bytes to restore
- Time range of restore
- Consumer offset actions
- Errors and warnings

---

## show-offset-mapping

Show offset mapping for a backup.

```bash
kafka-backup show-offset-mapping --path <PATH> --backup-id <ID> [--format <FORMAT>]
```

### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-p, --path` | PATH | Yes | - | Path to storage location |
| `-b, --backup-id` | STRING | Yes | - | Backup ID to show offset mapping for |
| `-f, --format` | STRING | No | text | Output: `text`, `json`, `yaml`, `csv` |

### Examples

```bash
# Human-readable output
kafka-backup show-offset-mapping --path /data --backup-id backup-001

# CSV for spreadsheets
kafka-backup show-offset-mapping -p /data -b backup-001 --format csv

# JSON for programmatic use
kafka-backup show-offset-mapping -p /data -b backup-001 -f json
```

### Output

```
Offset Mapping: backup-001
─────────────────────────────────────────────────────────────
Topic       Partition  Source Start  Source End  Records
─────────────────────────────────────────────────────────────
orders      0          0             150233      150234
orders      1          0             148891      148892
orders      2          0             152456      152457
payments    0          0             78234       78235
...

To reset consumer groups, use:
kafka-consumer-groups --bootstrap-server <broker> \
  --group <group-name> --topic orders:0 \
  --reset-offsets --to-offset 150233 --execute
```

---

## offset-reset

Generate or execute consumer group offset reset plans.

### offset-reset plan

Generate an offset reset plan from backup's offset mapping.

```bash
kafka-backup offset-reset plan \
  --path <PATH> \
  --backup-id <ID> \
  --groups <GROUPS> \
  --bootstrap-servers <SERVERS> \
  [--format <FORMAT>] \
  [--dry-run <BOOL>]
```

#### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-p, --path` | PATH | Yes | - | Path to storage location |
| `-b, --backup-id` | STRING | Yes | - | Backup ID with offset mapping |
| `-g, --groups` | STRING | Yes | - | Consumer groups (comma-separated) |
| `--bootstrap-servers` | STRING | Yes | - | Kafka bootstrap servers |
| `-f, --format` | STRING | No | text | Output: `text`, `json`, `csv`, `shell-script` |
| `--dry-run` | BOOL | No | true | Preview only, no changes |

#### Examples

```bash
kafka-backup offset-reset plan \
  --path /data \
  --backup-id backup-001 \
  --groups my-group,another-group \
  --bootstrap-servers localhost:9092

# Generate shell script
kafka-backup offset-reset plan \
  -p /data -b backup-001 \
  -g consumer-group \
  --bootstrap-servers broker-1:9092 \
  --format shell-script
```

### offset-reset execute

Execute an offset reset plan.

```bash
kafka-backup offset-reset execute \
  --path <PATH> \
  --backup-id <ID> \
  --groups <GROUPS> \
  --bootstrap-servers <SERVERS> \
  [--security-protocol <PROTOCOL>]
```

#### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-p, --path` | PATH | Yes | - | Path to storage location |
| `-b, --backup-id` | STRING | Yes | - | Backup ID |
| `-g, --groups` | STRING | Yes | - | Consumer groups |
| `--bootstrap-servers` | STRING | Yes | - | Kafka bootstrap servers |
| `--security-protocol` | STRING | No | PLAINTEXT | Security: `PLAINTEXT`, `SSL`, `SASL_SSL`, `SASL_PLAINTEXT` |

#### Examples

```bash
kafka-backup offset-reset execute \
  --path /data \
  --backup-id backup-001 \
  --groups my-group \
  --bootstrap-servers localhost:9092

# With SSL
kafka-backup offset-reset execute \
  -p /data -b backup-001 \
  -g consumer-group \
  --bootstrap-servers broker-1:9092 \
  --security-protocol SSL
```

### offset-reset script

Generate a shell script for manual offset reset.

```bash
kafka-backup offset-reset script \
  --path <PATH> \
  --backup-id <ID> \
  --groups <GROUPS> \
  --bootstrap-servers <SERVERS> \
  [--output <PATH>]
```

#### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-o, --output` | PATH | No | stdout | Output file path |

---

## offset-reset-bulk

Execute bulk parallel offset reset (optimized for large consumer groups).

```bash
kafka-backup offset-reset-bulk \
  --path <PATH> \
  --backup-id <ID> \
  --groups <GROUPS> \
  --bootstrap-servers <SERVERS> \
  [OPTIONS]
```

### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `-p, --path` | PATH | Yes | - | Path to storage location |
| `-b, --backup-id` | STRING | Yes | - | Backup ID |
| `-g, --groups` | STRING | Yes | - | Consumer groups (comma-separated) |
| `--bootstrap-servers` | STRING | Yes | - | Kafka bootstrap servers |
| `--max-concurrent` | INT | No | 50 | Maximum concurrent requests |
| `--max-retries` | INT | No | 3 | Maximum retry attempts |
| `--security-protocol` | STRING | No | PLAINTEXT | Security protocol |
| `-f, --format` | STRING | No | text | Output: `text`, `json` |

### Examples

```bash
kafka-backup offset-reset-bulk \
  --path /data \
  --backup-id backup-001 \
  --groups group1,group2 \
  --bootstrap-servers broker-1:9092,broker-2:9092 \
  --max-concurrent 100

# With metrics output
kafka-backup offset-reset-bulk \
  -p /data -b backup-001 \
  -g my-group \
  --bootstrap-servers localhost:9092 \
  --format json
```

### Performance

- ~50x faster than sequential offset reset
- Per-partition retry with exponential backoff
- Detailed metrics (p50/p99 latency, throughput)
- Progress reporting

---

## offset-rollback

Snapshot and rollback consumer group offsets.

### offset-rollback snapshot

Create a snapshot of current consumer group offsets.

```bash
kafka-backup offset-rollback snapshot \
  --path <PATH> \
  --groups <GROUPS> \
  --bootstrap-servers <SERVERS> \
  [--description <DESC>]
```

#### Options

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | PATH | Yes | Path to store snapshots |
| `-g, --groups` | STRING | Yes | Consumer groups |
| `--bootstrap-servers` | STRING | Yes | Kafka bootstrap servers |
| `-d, --description` | STRING | No | Snapshot description |
| `--security-protocol` | STRING | No | Security protocol |
| `-f, --format` | STRING | No | Output: `text`, `json` |

#### Example

```bash
kafka-backup offset-rollback snapshot \
  --path /data/snapshots \
  --groups my-group \
  --bootstrap-servers localhost:9092 \
  --description "Before maintenance"
```

### offset-rollback list

List available offset snapshots.

```bash
kafka-backup offset-rollback list --path <PATH>
```

### offset-rollback show

Show details of a specific snapshot.

```bash
kafka-backup offset-rollback show \
  --path <PATH> \
  --snapshot-id <ID>
```

### offset-rollback rollback

Rollback offsets to a previous snapshot.

```bash
kafka-backup offset-rollback rollback \
  --path <PATH> \
  --snapshot-id <ID> \
  --bootstrap-servers <SERVERS> \
  [--verify <BOOL>]
```

#### Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--verify` | BOOL | No | true | Verify offsets after rollback |

### offset-rollback verify

Verify current offsets match a snapshot.

```bash
kafka-backup offset-rollback verify \
  --path <PATH> \
  --snapshot-id <ID> \
  --bootstrap-servers <SERVERS>
```

### offset-rollback delete

Delete a snapshot.

```bash
kafka-backup offset-rollback delete \
  --path <PATH> \
  --snapshot-id <ID>
```

---

## three-phase-restore

Run complete three-phase restore with automatic offset reset.

```bash
kafka-backup three-phase-restore --config <PATH>
```

### Options

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-c, --config` | PATH | Yes | Path to configuration file |

### What It Does

1. **Phase 1**: Collect offset headers from source backup
2. **Phase 2**: Restore data to target cluster
3. **Phase 3**: Reset consumer group offsets

### Example

```bash
kafka-backup three-phase-restore --config dr-restore.yaml
```

### Output

```
Three-Phase Restore Report
════════════════════════════════════════════════════════════

Backup ID: production-backup-001
Status: ✓ SUCCESS

Phase 2 - Data Restore:
  Records Restored: 2,456,789
  Topics: 4
  Duration: 8m 23s

Phase 3 - Offset Reset:
  Strategy: header-based
  Consumer Groups: 3
  Partitions Reset: 33

Warnings: 0
```

---

## Environment Variables

The CLI respects these environment variables:

| Variable | Description |
|----------|-------------|
| `KAFKA_BACKUP_CONFIG` | Default config file path |
| `RUST_LOG` | Logging level (e.g., `info`, `debug`, `trace`) |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 |
| `AWS_REGION` | AWS region for S3 |
| `AZURE_STORAGE_ACCOUNT` | Azure storage account name |
| `AZURE_STORAGE_KEY` | Azure storage account key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON |
