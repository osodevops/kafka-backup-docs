---
title: CLI Basics
description: Learn the OSO Kafka Backup command-line interface - commands, flags, and common operations
sidebar_position: 3
---

# CLI Basics

OSO Kafka Backup provides a powerful command-line interface with 12 commands for backup, restore, and offset management operations.

## Global Options

All commands support these global options:

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Enable verbose logging (use `-vv` for trace level) |
| `--help` | Show help for any command |
| `--version` | Show version information |

```bash
# Enable debug logging
kafka-backup -v backup --config backup.yaml

# Enable trace logging (very verbose)
kafka-backup -vv backup --config backup.yaml
```

## Command Overview

| Command | Description |
|---------|-------------|
| `backup` | Run a backup operation |
| `restore` | Restore data from a backup |
| `list` | List available backups |
| `status` | Show backup status and statistics |
| `describe` | Show detailed backup manifest |
| `validate` | Validate backup integrity |
| `validate-restore` | Validate restore configuration (dry-run) |
| `show-offset-mapping` | Display offset mapping for consumer groups |
| `offset-reset` | Generate or execute offset reset plans |
| `offset-reset-bulk` | Parallel bulk offset reset |
| `offset-rollback` | Snapshot and rollback consumer offsets |
| `three-phase-restore` | Complete restore with automatic offset reset |

## Core Commands

### backup

Run a backup operation from a Kafka cluster to storage.

```bash
kafka-backup backup --config <path>
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-c, --config` | string | Yes | Path to backup configuration YAML |

**Example:**

```bash
kafka-backup backup --config /etc/kafka-backup/backup.yaml
```

### restore

Restore data from a backup to a Kafka cluster.

```bash
kafka-backup restore --config <path>
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-c, --config` | string | Yes | Path to restore configuration YAML |

**Example:**

```bash
kafka-backup restore --config /etc/kafka-backup/restore.yaml
```

### list

List available backups in a storage location.

```bash
kafka-backup list --path <path> [--backup-id <id>]
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | string | Yes | Path to storage location |
| `-b, --backup-id` | string | No | Show details for specific backup |

**Examples:**

```bash
# List all backups
kafka-backup list --path /var/lib/kafka-backup/data

# List all backups from S3
kafka-backup list --path s3://my-bucket/backups

# Show details for a specific backup
kafka-backup list --path /data --backup-id daily-backup-001
```

### status

Show status and statistics of a backup.

```bash
kafka-backup status --path <path> --backup-id <id> [--db-path <path>]
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | string | Yes | Path to storage location |
| `-b, --backup-id` | string | Yes | Backup ID to show status for |
| `--db-path` | string | No | Path to offset database for progress tracking |

**Example:**

```bash
kafka-backup status --path /data --backup-id backup-001
```

**Output includes:**

- Manifest information (created date, source cluster)
- Topic, partition, and segment counts
- Record and size statistics
- Compression ratio
- Offset tracking status per partition

### describe

Show detailed backup manifest information.

```bash
kafka-backup describe --path <path> --backup-id <id> [--format <format>]
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | string | Yes | Path to storage location |
| `-b, --backup-id` | string | Yes | Backup ID to describe |
| `-f, --format` | string | No | Output format: `text` (default), `json`, `yaml` |

**Examples:**

```bash
# Text output (default)
kafka-backup describe --path /data --backup-id backup-001

# JSON output for scripting
kafka-backup describe --path /data --backup-id backup-001 --format json

# YAML output
kafka-backup describe --path /data --backup-id backup-001 -f yaml
```

### validate

Validate backup integrity.

```bash
kafka-backup validate --path <path> --backup-id <id> [--deep]
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | string | Yes | Path to storage location |
| `-b, --backup-id` | string | Yes | Backup ID to validate |
| `--deep` | bool | No | Perform deep validation (read all segments) |

**Examples:**

```bash
# Quick validation (check existence and metadata)
kafka-backup validate --path /data --backup-id backup-001

# Deep validation (read and verify all segments)
kafka-backup validate --path /data --backup-id backup-001 --deep
```

**Validation Report:**

- Segments checked/valid/missing/corrupted
- Records validated
- Issues found with details
- Final result: VALID or INVALID

### validate-restore

Validate a restore configuration without executing it.

```bash
kafka-backup validate-restore --config <path> [--format <format>]
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-c, --config` | string | Yes | Path to restore configuration |
| `-f, --format` | string | No | Output format: `text`, `json`, `yaml` |

**Example:**

```bash
kafka-backup validate-restore --config restore.yaml --format json
```

**Report includes:**

- Restore status (VALID or INVALID)
- Topics and segments to process
- Records and bytes to restore
- Time range
- Errors and warnings

## Offset Management Commands

### show-offset-mapping

Display offset mapping for a backup (useful for consumer group reset).

```bash
kafka-backup show-offset-mapping --path <path> --backup-id <id> [--format <format>]
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `-p, --path` | string | Yes | Path to storage location |
| `-b, --backup-id` | string | Yes | Backup ID |
| `-f, --format` | string | No | Output: `text`, `json`, `yaml`, `csv` |

**Example:**

```bash
kafka-backup show-offset-mapping --path /data --backup-id backup-001 --format csv
```

### offset-reset

Generate or execute consumer group offset reset plans.

**Subcommands:**

```bash
# Generate a reset plan
kafka-backup offset-reset plan \
  --path <path> \
  --backup-id <id> \
  --groups <group1,group2> \
  --bootstrap-servers <servers>

# Execute a reset plan
kafka-backup offset-reset execute \
  --path <path> \
  --backup-id <id> \
  --groups <group1> \
  --bootstrap-servers <servers>

# Generate a shell script for manual execution
kafka-backup offset-reset script \
  --path <path> \
  --backup-id <id> \
  --groups <group1> \
  --bootstrap-servers <servers> \
  --output reset.sh
```

### offset-reset-bulk

Execute bulk parallel offset reset (50x faster than sequential).

```bash
kafka-backup offset-reset-bulk \
  --path <path> \
  --backup-id <id> \
  --groups <groups> \
  --bootstrap-servers <servers> \
  [--max-concurrent <num>] \
  [--max-retries <num>]
```

**Options:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--max-concurrent` | int | 50 | Maximum concurrent requests |
| `--max-retries` | int | 3 | Maximum retry attempts |
| `--security-protocol` | string | PLAINTEXT | Security protocol |

### offset-rollback

Snapshot and rollback consumer group offsets.

**Subcommands:**

```bash
# Create a snapshot before making changes
kafka-backup offset-rollback snapshot \
  --path /data/snapshots \
  --groups my-group \
  --bootstrap-servers localhost:9092 \
  --description "Before migration"

# List available snapshots
kafka-backup offset-rollback list --path /data/snapshots

# Show snapshot details
kafka-backup offset-rollback show \
  --path /data/snapshots \
  --snapshot-id snapshot-20241203-100000

# Rollback to a previous snapshot
kafka-backup offset-rollback rollback \
  --path /data/snapshots \
  --snapshot-id snapshot-20241203-100000 \
  --bootstrap-servers localhost:9092

# Verify offsets match a snapshot
kafka-backup offset-rollback verify \
  --path /data/snapshots \
  --snapshot-id snapshot-20241203-100000 \
  --bootstrap-servers localhost:9092

# Delete a snapshot
kafka-backup offset-rollback delete \
  --path /data/snapshots \
  --snapshot-id snapshot-20241203-100000
```

### three-phase-restore

Run a complete three-phase restore with automatic offset reset.

```bash
kafka-backup three-phase-restore --config <path>
```

This command performs:

1. **Phase 1**: Collect offset headers from source backup
2. **Phase 2**: Restore data to target cluster
3. **Phase 3**: Reset consumer group offsets

## Common Workflows

### Daily Backup Verification

```bash
#!/bin/bash
# Verify yesterday's backup

BACKUP_PATH="/var/lib/kafka-backup/data"
BACKUP_ID="daily-$(date -d yesterday +%Y%m%d)"

# Quick validation
kafka-backup validate --path "$BACKUP_PATH" --backup-id "$BACKUP_ID"

# Get backup statistics
kafka-backup describe --path "$BACKUP_PATH" --backup-id "$BACKUP_ID" --format json
```

### Pre-Migration Offset Snapshot

```bash
#!/bin/bash
# Snapshot offsets before migration

kafka-backup offset-rollback snapshot \
  --path /data/snapshots \
  --groups "app-consumer,analytics-consumer" \
  --bootstrap-servers broker-1:9092,broker-2:9092 \
  --description "Pre-migration snapshot"
```

### Disaster Recovery Restore

```bash
#!/bin/bash
# Full disaster recovery restore

# 1. Validate the backup
kafka-backup validate --path s3://backups/kafka --backup-id latest --deep

# 2. Validate restore config
kafka-backup validate-restore --config dr-restore.yaml

# 3. Execute three-phase restore
kafka-backup three-phase-restore --config dr-restore.yaml
```

## Next Steps

- **[First Backup Tutorial](./first-backup)** - Step-by-step backup walkthrough
- **[CLI Reference](../reference/cli-reference)** - Complete command documentation
- **[Configuration Reference](../reference/config-yaml)** - All configuration options
