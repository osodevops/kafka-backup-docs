---
title: Compression
description: How OSO Kafka Backup compresses data for efficient storage
sidebar_position: 4
---

# Compression

OSO Kafka Backup supports multiple compression algorithms to reduce storage costs and improve transfer speeds.

## Supported Algorithms

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| **Zstd** | Zstandard - high ratio, fast | General use (default) |
| **LZ4** | Very fast, moderate ratio | Speed-critical workloads |
| **None** | No compression | Pre-compressed data |

## Compression Comparison

### Performance Characteristics

| Metric | Zstd (level 3) | Zstd (level 9) | LZ4 | None |
|--------|----------------|----------------|-----|------|
| Compression ratio | 4-6x | 6-10x | 2-3x | 1x |
| Compression speed | ~400 MB/s | ~100 MB/s | ~700 MB/s | N/A |
| Decompression speed | ~1000 MB/s | ~900 MB/s | ~2000 MB/s | N/A |
| CPU usage | Medium | High | Low | None |
| Memory usage | Medium | High | Low | None |

### Real-World Example

For 100 GB of JSON Kafka messages:

| Algorithm | Compressed Size | Backup Time | Restore Time |
|-----------|-----------------|-------------|--------------|
| Zstd-3 | ~20 GB | 5 min | 2 min |
| Zstd-9 | ~12 GB | 15 min | 2 min |
| LZ4 | ~40 GB | 3 min | 1 min |
| None | 100 GB | 2 min | 2 min |

## Configuration

### Basic Configuration

```yaml
backup:
  compression: zstd           # Algorithm: zstd, lz4, none
  compression_level: 3        # Level: 1-22 for zstd, 1-12 for lz4
```

### Zstd Configuration

```yaml
backup:
  compression: zstd
  compression_level: 3        # Default, good balance

  # Level guidelines:
  # 1-3:   Fast compression, good ratio
  # 4-6:   Balanced (recommended)
  # 7-12:  Slower, better ratio
  # 13-22: Very slow, best ratio (archival)
```

### LZ4 Configuration

```yaml
backup:
  compression: lz4
  compression_level: 1        # LZ4 levels have less impact
```

### No Compression

```yaml
backup:
  compression: none
  # Use when:
  # - Data is already compressed (images, video)
  # - Speed is critical and storage is cheap
  # - Debugging/inspection needed
```

## How Compression Works

### Backup Compression Pipeline

```
Kafka Records → Batch → Compress → Write to Storage
     ↓            ↓         ↓            ↓
  Raw data    Group      Apply      Segment
  (1 MB)    records    algorithm     file
            (10 MB)    (2 MB)      (.zst)
```

Detailed flow:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Compression Pipeline                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Batch Records                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Record 1 │ Record 2 │ Record 3 │ ... │ Record N            │    │
│  │  (100 B)  │ (200 B)  │ (150 B)  │     │ (180 B)             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  2. Serialize Batch                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Header │ Record 1 │ Record 2 │ ... │ Record N │ Checksum   │    │
│  │  (32 B) │          │          │     │          │ (4 B)      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  3. Compress                                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Zstd Frame                                                  │    │
│  │  ┌───────────────────────────────────────────────────────┐  │    │
│  │  │ Magic │ Frame Header │ Compressed Blocks │ Checksum   │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               ▼                                      │
│  4. Write Segment                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  segment-0001.dat.zst                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Restore Decompression Pipeline

```
Storage → Read → Decompress → Parse → Write to Kafka
   ↓        ↓        ↓          ↓          ↓
Segment   Stream  Apply       Extract   Produce
 file      read  algorithm   records    records
(.zst)   (2 MB)  (10 MB)    (array)   (1 at a time)
```

## Streaming Compression

OSO Kafka Backup uses streaming compression to minimize memory usage:

```
Traditional (Buffer All):
┌──────────────────────────────────────────────────────────────┐
│  Read all records → Buffer 10 GB → Compress → Write          │
│  Memory usage: 10 GB+                                         │
└──────────────────────────────────────────────────────────────┘

Streaming (OSO Kafka Backup):
┌──────────────────────────────────────────────────────────────┐
│  Read batch → Compress batch → Write batch → (repeat)        │
│  Memory usage: ~100 MB (configurable)                        │
└──────────────────────────────────────────────────────────────┘
```

### Streaming Configuration

```yaml
backup:
  compression: zstd
  compression_level: 3

  # Batch size controls memory vs efficiency
  batch_size: 10000             # Records per batch
  max_batch_bytes: 104857600    # 100 MB max batch
```

## Compression Levels

### Zstd Levels Explained

```
Level 1-3:  Fast mode
            ├── Speed: Very fast
            ├── Ratio: 3-4x
            └── Use case: Real-time backup, bandwidth constrained

Level 4-6:  Default mode
            ├── Speed: Fast
            ├── Ratio: 4-6x
            └── Use case: Daily backups, general use

Level 7-12: High compression
            ├── Speed: Moderate
            ├── Ratio: 5-8x
            └── Use case: Weekly backups, archival

Level 13-22: Ultra compression
            ├── Speed: Slow
            ├── Ratio: 6-10x
            └── Use case: Long-term archival, cold storage
```

### Choosing the Right Level

```yaml
# Speed priority (CI/CD, real-time)
backup:
  compression: zstd
  compression_level: 1

# Balanced (daily backups)
backup:
  compression: zstd
  compression_level: 3

# Storage priority (archival)
backup:
  compression: zstd
  compression_level: 9

# Maximum compression (cold storage, rare access)
backup:
  compression: zstd
  compression_level: 19
```

## Data Type Optimization

Different data types compress differently:

| Data Type | Typical Ratio | Recommendation |
|-----------|---------------|----------------|
| JSON | 6-10x | Zstd level 3-6 |
| Avro | 4-6x | Zstd level 3 |
| Protobuf | 3-5x | Zstd level 3 |
| Plain text | 5-8x | Zstd level 3-6 |
| Binary (random) | 1-1.5x | None or LZ4 |
| Pre-compressed | 0.9-1.1x | None |

### Topic-Specific Compression

Different topics may benefit from different settings:

```yaml
# Global default
backup:
  compression: zstd
  compression_level: 3

# Topic-specific overrides (if supported)
# Note: Currently applies globally
```

## Compression and Kafka's Compression

### Double Compression

Kafka itself supports compression (gzip, snappy, lz4, zstd). OSO Kafka Backup compresses at the batch level:

```
Kafka Message (may be compressed)
        ↓
OSO Backup reads (decompressed by Kafka client)
        ↓
OSO Backup compresses batch
        ↓
Storage

Result: Backup compression works on decompressed data
```

### Recommendation

If Kafka topics use compression:

```yaml
# Kafka topic has gzip compression
# OSO Backup still compresses (on decompressed data)
backup:
  compression: zstd
  compression_level: 3

# This is efficient because:
# 1. Kafka client decompresses automatically
# 2. Zstd often achieves better ratio than gzip
# 3. Zstd decompression is faster for restore
```

## Performance Tuning

### CPU vs Storage Trade-off

```
High CPU, Low Storage:
  compression_level: 9-12
  Result: Slower backup, smaller files, fast restore

Balanced:
  compression_level: 3-6
  Result: Fast backup, good compression, fast restore

Low CPU, Higher Storage:
  compression_level: 1-2
  Result: Very fast backup, larger files, fast restore
```

### Parallel Compression

Zstd supports multi-threaded compression (used automatically):

```
CPU Cores: 8
Partitions: 16

Thread allocation:
  - 8 parallel partition consumers
  - Each with dedicated compression context
  - Effective throughput: 8x single-thread
```

### Memory Configuration

```yaml
backup:
  compression: zstd
  compression_level: 3

  # Higher level = more memory
  # Level 3: ~100 MB per compression context
  # Level 9: ~500 MB per compression context
  # Level 19: ~1 GB per compression context
```

## Monitoring Compression

### Metrics

```promql
# Compression ratio
kafka_backup_compression_ratio

# Compression throughput (MB/s)
rate(kafka_backup_bytes_compressed_total[5m]) / 1048576

# Time spent compressing
kafka_backup_compression_duration_seconds
```

### Backup Statistics

```bash
kafka-backup describe \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --format json | jq '.compression'
```

Output:

```json
{
  "algorithm": "zstd",
  "level": 3,
  "original_size_bytes": 10737418240,
  "compressed_size_bytes": 2147483648,
  "ratio": 5.0,
  "compression_time_secs": 120
}
```

## Best Practices

### General Recommendations

1. **Start with Zstd level 3** - good default for most cases
2. **Use LZ4 for speed-critical** - when backup window is tight
3. **Use higher levels for archival** - level 9+ for cold storage
4. **Disable for pre-compressed data** - images, video, encrypted

### Storage Cost Optimization

```yaml
# Tier 1: Hot backups (hourly, 7-day retention)
backup:
  compression: zstd
  compression_level: 3
  # Fast backup, reasonable size

# Tier 2: Warm backups (daily, 30-day retention)
backup:
  compression: zstd
  compression_level: 6
  # Balanced for daily use

# Tier 3: Cold backups (weekly, 1-year retention)
backup:
  compression: zstd
  compression_level: 12
  # Maximum compression for long-term storage
```

### Network Optimization

For bandwidth-constrained environments:

```yaml
backup:
  compression: zstd
  compression_level: 9  # Higher compression = less transfer

# Trade-off:
# - Slower backup (more CPU time)
# - Less network transfer
# - Smaller storage
```

## Troubleshooting

### Compression Too Slow

```yaml
# Reduce compression level
backup:
  compression: zstd
  compression_level: 1  # Fastest

# Or switch to LZ4
backup:
  compression: lz4
```

### Poor Compression Ratio

Check data type:

```bash
# Sample topic data
kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic my-topic \
  --max-messages 100 > sample.txt

# Check compressibility
zstd -3 sample.txt
ls -la sample.txt*
```

### High Memory Usage

```yaml
# Reduce batch size
backup:
  compression: zstd
  compression_level: 3
  batch_size: 1000          # Smaller batches
  max_batch_bytes: 10485760  # 10 MB max
```

## Next Steps

- [Zero-Copy Optimization](./zero-copy-optimization) - Additional performance techniques
- [Performance Tuning Guide](../guides/performance-tuning) - Optimization strategies
- [Storage Format](../reference/storage-format) - How compressed data is stored
