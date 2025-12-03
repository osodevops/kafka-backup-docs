---
title: Storage Format
description: OSO Kafka Backup storage layout and file format reference
sidebar_position: 3
---

# Storage Format

This document describes the storage layout and file formats used by OSO Kafka Backup.

## Directory Structure

Backups are organized in a hierarchical directory structure:

```
<storage-root>/
├── <backup-id>/
│   ├── manifest.json           # Backup metadata
│   ├── topics/
│   │   ├── <topic-name>/
│   │   │   ├── <partition>/
│   │   │   │   ├── segment-00000000.kbs    # Segment files
│   │   │   │   ├── segment-00000001.kbs
│   │   │   │   ├── segment-00000002.kbs
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── checkpoints/
│       └── checkpoint.json     # Progress checkpoint
└── <another-backup-id>/
    └── ...
```

## Manifest File

The `manifest.json` file contains backup metadata:

```json
{
  "version": "1.0",
  "backup_id": "production-backup-001",
  "created_at": "2024-12-03T10:00:00Z",
  "completed_at": "2024-12-03T10:15:32Z",
  "source_cluster": {
    "cluster_id": "prod-cluster-east",
    "bootstrap_servers": ["broker-1:9092", "broker-2:9092"]
  },
  "compression": {
    "algorithm": "zstd",
    "level": 3
  },
  "statistics": {
    "topics": 5,
    "partitions": 24,
    "segments": 156,
    "records": 2456789,
    "uncompressed_bytes": 1288490188,
    "compressed_bytes": 262832640
  },
  "time_range": {
    "earliest_timestamp": 1701388800000,
    "latest_timestamp": 1701475199000
  },
  "topics": [
    {
      "name": "orders",
      "partitions": [
        {
          "partition": 0,
          "first_offset": 0,
          "last_offset": 150233,
          "records": 150234,
          "segments": 12
        },
        {
          "partition": 1,
          "first_offset": 0,
          "last_offset": 148891,
          "records": 148892,
          "segments": 11
        }
      ]
    }
  ]
}
```

### Manifest Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Manifest format version |
| `backup_id` | string | Unique backup identifier |
| `created_at` | string | ISO 8601 timestamp when backup started |
| `completed_at` | string | ISO 8601 timestamp when backup completed |
| `source_cluster.cluster_id` | string | Source cluster identifier |
| `source_cluster.bootstrap_servers` | array | Source broker addresses |
| `compression.algorithm` | string | Compression algorithm used |
| `compression.level` | int | Compression level |
| `statistics.topics` | int | Number of topics backed up |
| `statistics.partitions` | int | Number of partitions |
| `statistics.segments` | int | Number of segment files |
| `statistics.records` | int | Total records |
| `statistics.uncompressed_bytes` | int | Original data size |
| `statistics.compressed_bytes` | int | Compressed data size |
| `time_range.earliest_timestamp` | int | Earliest message timestamp (Unix ms) |
| `time_range.latest_timestamp` | int | Latest message timestamp (Unix ms) |

## Segment Files

Segment files (`.kbs` - Kafka Backup Segment) contain the actual message data.

### Segment File Format

```
┌─────────────────────────────────────────┐
│           Segment Header (32 bytes)      │
├─────────────────────────────────────────┤
│              Record Batch 1              │
├─────────────────────────────────────────┤
│              Record Batch 2              │
├─────────────────────────────────────────┤
│                   ...                    │
├─────────────────────────────────────────┤
│              Record Batch N              │
├─────────────────────────────────────────┤
│           Segment Footer (16 bytes)      │
└─────────────────────────────────────────┘
```

### Segment Header

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 4 | Magic | Magic bytes: `KBS1` |
| 4 | 1 | Version | Format version |
| 5 | 1 | Compression | Compression algorithm (0=none, 1=lz4, 2=zstd) |
| 6 | 2 | Flags | Reserved flags |
| 8 | 8 | First Offset | First record offset in segment |
| 16 | 8 | Record Count | Number of records in segment |
| 24 | 8 | Checksum | CRC64 checksum of segment data |

### Record Batch

Each record batch contains:

```
┌─────────────────────────────────────────┐
│         Batch Header (24 bytes)          │
├─────────────────────────────────────────┤
│           Compressed Records             │
└─────────────────────────────────────────┘
```

#### Batch Header

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 8 | Base Offset | First offset in batch |
| 8 | 4 | Record Count | Number of records |
| 12 | 4 | Compressed Size | Size of compressed data |
| 16 | 4 | Uncompressed Size | Original data size |
| 20 | 4 | CRC32 | Checksum of compressed data |

### Record Format

Records are stored in a compact binary format compatible with Kafka's record format:

```
┌─────────────────────────────────────────┐
│ Offset Delta (varint)                    │
├─────────────────────────────────────────┤
│ Timestamp Delta (varint)                 │
├─────────────────────────────────────────┤
│ Key Length (varint)                      │
├─────────────────────────────────────────┤
│ Key Data (bytes)                         │
├─────────────────────────────────────────┤
│ Value Length (varint)                    │
├─────────────────────────────────────────┤
│ Value Data (bytes)                       │
├─────────────────────────────────────────┤
│ Headers Count (varint)                   │
├─────────────────────────────────────────┤
│ Headers (key-value pairs)                │
└─────────────────────────────────────────┘
```

#### Offset Header

When `include_offset_headers: true` is set, each record includes a header:

| Header Key | Value | Description |
|------------|-------|-------------|
| `x-kafka-backup-offset` | string | Original Kafka offset |
| `x-kafka-backup-timestamp` | string | Original timestamp (Unix ms) |
| `x-kafka-backup-partition` | string | Original partition number |

## Checkpoint File

The `checkpoint.json` file tracks backup progress for resumable operations:

```json
{
  "backup_id": "production-backup-001",
  "timestamp": "2024-12-03T10:05:00Z",
  "topics": {
    "orders": {
      "0": {
        "offset": 75234,
        "timestamp": 1701432000000,
        "segment": "segment-00000005.kbs",
        "segment_offset": 12456
      },
      "1": {
        "offset": 74123,
        "timestamp": 1701432000000,
        "segment": "segment-00000005.kbs",
        "segment_offset": 11234
      }
    }
  }
}
```

### Checkpoint Fields

| Field | Description |
|-------|-------------|
| `backup_id` | Backup being checkpointed |
| `timestamp` | When checkpoint was created |
| `topics.<topic>.<partition>.offset` | Last backed up offset |
| `topics.<topic>.<partition>.timestamp` | Last message timestamp |
| `topics.<topic>.<partition>.segment` | Current segment file |
| `topics.<topic>.<partition>.segment_offset` | Position in segment |

## S3 Object Layout

When using S3 storage, the structure maps to object keys:

```
s3://bucket/prefix/
├── backup-001/
│   ├── manifest.json
│   ├── topics/orders/0/segment-00000000.kbs
│   ├── topics/orders/0/segment-00000001.kbs
│   ├── topics/orders/1/segment-00000000.kbs
│   └── ...
└── backup-002/
    └── ...
```

### S3 Storage Classes

Backups can be stored in different S3 storage classes for cost optimization:

| Storage Class | Use Case |
|---------------|----------|
| `STANDARD` | Frequently accessed backups |
| `STANDARD_IA` | Infrequent access (30+ days) |
| `GLACIER_IR` | Archive with instant retrieval |
| `GLACIER` | Long-term archive |

## Compression

### Zstandard (zstd)

Default compression algorithm. Provides excellent compression ratio with fast decompression.

| Level | Ratio | Speed | Use Case |
|-------|-------|-------|----------|
| 1-3 | Good | Very Fast | Default, balanced |
| 4-9 | Better | Fast | Higher compression |
| 10-19 | Best | Moderate | Maximum compression |
| 20-22 | Optimal | Slow | Archive |

### LZ4

Extremely fast compression with moderate ratio.

| Mode | Ratio | Speed | Use Case |
|------|-------|-------|----------|
| Default | Moderate | Fastest | High-throughput backups |

### No Compression

Use `compression: none` when:
- Data is already compressed
- Maximum restore speed is critical
- Storage cost is not a concern

## Integrity Verification

### Checksums

Every segment includes:

- **Segment checksum**: CRC64 of entire segment
- **Batch checksum**: CRC32 of each record batch
- **Record checksum**: Optional per-record verification

### Validation

```bash
# Quick validation (check metadata and structure)
kafka-backup validate --path /data --backup-id backup-001

# Deep validation (read and verify all data)
kafka-backup validate --path /data --backup-id backup-001 --deep
```

## Compatibility

### Forward Compatibility

New versions can read backups created by older versions.

### Backward Compatibility

Older versions may not read backups created by newer versions if the manifest version is higher.

### Version Matrix

| Backup Version | Reader Version | Compatible |
|----------------|----------------|------------|
| 1.0 | 1.0+ | Yes |
| 1.1 | 1.0 | Limited* |
| 1.1 | 1.1+ | Yes |

*Limited: Core data readable, new features unavailable
