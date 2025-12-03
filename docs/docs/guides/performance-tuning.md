---
title: Performance Tuning
description: Optimize OSO Kafka Backup throughput and resource usage
sidebar_position: 4
---

# Performance Tuning

Optimize backup and restore operations for maximum throughput and efficiency.

## Performance Overview

OSO Kafka Backup is built in Rust for high performance:

- **Throughput**: 100+ MB/s per partition
- **Memory efficient**: Streaming processing, minimal buffering
- **CPU efficient**: Native compilation, zero-copy where possible

## Measuring Performance

### During Backup

```bash
kafka-backup -v backup --config backup.yaml
```

Output includes:

```
[INFO] Backup completed
[INFO] Summary:
  Records: 2,456,789
  Duration: 4m 23s
  Throughput: 9,346 records/sec
  Throughput: 45.2 MB/sec (uncompressed)
  Compression ratio: 4.9x
```

### After Backup

```bash
kafka-backup status \
  --path /data/backups \
  --backup-id production-backup
```

## Backup Performance Tuning

### Compression Settings

Compression significantly impacts both storage costs and performance.

| Algorithm | Speed | Ratio | Use Case |
|-----------|-------|-------|----------|
| `none` | Fastest | 1x | Pre-compressed data |
| `lz4` | Very Fast | 2-3x | Speed priority |
| `zstd` (level 1-3) | Fast | 3-4x | Balanced (default) |
| `zstd` (level 4-9) | Moderate | 4-6x | Storage priority |
| `zstd` (level 10+) | Slow | 5-7x | Archive |

```yaml
backup:
  compression: zstd
  compression_level: 3  # Balanced performance
```

### Segment Size

Larger segments mean fewer storage operations but more memory usage:

```yaml
backup:
  segment_max_bytes: 268435456     # 256 MB (larger segments)
  segment_max_interval_ms: 120000  # Roll every 2 minutes
```

| Segment Size | Pros | Cons |
|--------------|------|------|
| 64 MB | Lower memory, frequent checkpoints | More S3 PUTs |
| 128 MB | Balanced (default) | - |
| 256 MB | Fewer storage operations | Higher memory |
| 512 MB | Minimal storage ops | High memory, delayed checkpoints |

### Parallelism

Control concurrent partition processing:

```yaml
backup:
  max_concurrent_partitions: 8  # Default: 4
```

Guidelines:
- 2-4 partitions: Single-core systems
- 4-8 partitions: Multi-core systems
- 8-16 partitions: High-performance systems

### Checkpoint Interval

Balance durability vs. performance:

```yaml
backup:
  checkpoint_interval_secs: 60  # Less frequent = faster
  sync_interval_secs: 120       # Storage sync interval
```

## Restore Performance Tuning

### Concurrent Partitions

```yaml
restore:
  max_concurrent_partitions: 8  # Increase for faster restore
```

### Batch Size

```yaml
restore:
  produce_batch_size: 5000  # Records per produce batch (default: 1000)
```

Larger batches = higher throughput but more memory.

### Rate Limiting

Avoid overwhelming target cluster:

```yaml
restore:
  rate_limit_records_per_sec: 100000  # Cap at 100k records/sec
  rate_limit_bytes_per_sec: 50000000  # Cap at 50 MB/sec
```

Set to `null` for unlimited.

## Storage Performance

### Filesystem

For local/NFS storage:

- Use SSDs for backup storage
- Use XFS or ext4 filesystems
- Mount with `noatime` option
- Ensure adequate I/O bandwidth

```bash
# Check I/O performance
fio --name=test --rw=write --bs=128k --size=1G --runtime=30
```

### S3

Optimize S3 performance:

1. **Use regional buckets** - Same region as Kafka cluster
2. **Enable Transfer Acceleration** - For cross-region backups
3. **Use larger segments** - Reduce PUT requests
4. **Use VPC endpoints** - Reduce latency

```yaml
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2  # Same as Kafka cluster
  # endpoint: https://s3-accelerate.amazonaws.com  # For acceleration
```

### Azure Blob

```yaml
storage:
  backend: azure
  container: kafka-backups
  # Use Premium block blob for high performance
```

### GCS

```yaml
storage:
  backend: gcs
  bucket: my-kafka-backups
  # Use regional bucket in same region as Kafka
```

## Kafka Connection Tuning

### Consumer Configuration (Backup)

The backup process uses Kafka consumer settings internally. These are optimized by default:

- `fetch.min.bytes`: 1 MB
- `fetch.max.wait.ms`: 500 ms
- `max.partition.fetch.bytes`: 10 MB

### Producer Configuration (Restore)

Restore operations use optimized producer settings:

- `batch.size`: 1 MB
- `linger.ms`: 5 ms
- `buffer.memory`: 64 MB

## Memory Optimization

### Estimating Memory Usage

```
Memory ≈ (concurrent_partitions × segment_size) + overhead

Example:
  8 partitions × 128 MB = 1 GB segment buffers
  + 256 MB overhead
  = ~1.25 GB total
```

### Reducing Memory

```yaml
backup:
  max_concurrent_partitions: 4   # Reduce parallelism
  segment_max_bytes: 67108864    # 64 MB segments
```

### Kubernetes Resources

```yaml
resources:
  requests:
    memory: 1Gi
    cpu: 500m
  limits:
    memory: 2Gi
    cpu: 2000m
```

## CPU Optimization

### Compression CPU Usage

Compression is the main CPU consumer:

| Compression | CPU Usage |
|------------|-----------|
| none | Minimal |
| lz4 | Low |
| zstd level 1-3 | Moderate |
| zstd level 4-9 | High |
| zstd level 10+ | Very High |

### Multi-Core Utilization

Increase parallelism to use more cores:

```yaml
backup:
  max_concurrent_partitions: 8  # Use 8 cores
```

## Network Optimization

### Bandwidth Estimation

```
Bandwidth = throughput × (1 + compression overhead)

Example:
  50 MB/s uncompressed data
  4x compression ratio
  = ~12.5 MB/s to storage
  + Kafka read bandwidth
```

### Reducing Network Usage

1. **Enable compression** - Reduces storage bandwidth
2. **Use local storage** - Eliminate network for storage
3. **Same-region resources** - Kafka, backup, storage in same region

## Benchmarking

### Backup Benchmark

```bash
# Time a backup
time kafka-backup backup --config backup.yaml

# With metrics
kafka-backup -v backup --config backup.yaml 2>&1 | tee backup.log
grep -E "(Throughput|Duration|Records)" backup.log
```

### Restore Benchmark

```bash
# Validate without executing (check estimated records)
kafka-backup validate-restore --config restore.yaml

# Time actual restore
time kafka-backup restore --config restore.yaml
```

## Performance Checklist

### Pre-Backup

- [ ] Kafka cluster has available bandwidth
- [ ] Storage has sufficient space and I/O
- [ ] Network path is optimized (same region/VPC)
- [ ] Compression level matches use case

### During Backup

- [ ] Monitor Kafka consumer lag
- [ ] Monitor storage write latency
- [ ] Monitor memory usage
- [ ] Monitor CPU usage

### Post-Backup

- [ ] Verify backup integrity
- [ ] Check compression ratio
- [ ] Review throughput metrics
- [ ] Optimize for next backup

## Troubleshooting Performance

### Slow Backup

**Symptoms**: Low throughput, long duration

**Causes and Solutions**:

| Cause | Solution |
|-------|----------|
| High compression level | Reduce `compression_level` |
| Low parallelism | Increase `max_concurrent_partitions` |
| Slow storage | Use faster storage, increase segment size |
| Network bottleneck | Use same-region storage |
| Kafka throttling | Check broker load |

### Slow Restore

**Symptoms**: Low restore throughput

**Causes and Solutions**:

| Cause | Solution |
|-------|----------|
| Target cluster overloaded | Add rate limiting, reduce parallelism |
| Small batch size | Increase `produce_batch_size` |
| Low parallelism | Increase `max_concurrent_partitions` |
| Decompression overhead | Pre-decompress in pipeline |

### High Memory Usage

**Symptoms**: OOM errors, memory pressure

**Solutions**:

1. Reduce `max_concurrent_partitions`
2. Reduce `segment_max_bytes`
3. Increase container/process memory limits

## Configuration Templates

### High Throughput (Large Cluster)

```yaml
backup:
  compression: lz4                    # Fast compression
  max_concurrent_partitions: 16       # High parallelism
  segment_max_bytes: 268435456        # 256 MB segments
  checkpoint_interval_secs: 120       # Less frequent checkpoints
```

### Balanced (Default)

```yaml
backup:
  compression: zstd
  compression_level: 3
  max_concurrent_partitions: 4
  segment_max_bytes: 134217728        # 128 MB
  checkpoint_interval_secs: 30
```

### Low Resource

```yaml
backup:
  compression: zstd
  compression_level: 1                # Minimal compression
  max_concurrent_partitions: 2        # Low parallelism
  segment_max_bytes: 67108864         # 64 MB segments
  checkpoint_interval_secs: 60
```

## Next Steps

- [Deployment Guide](../deployment) - Production deployment
- [Configuration Reference](../reference/config-yaml) - All options
- [Metrics Reference](../reference/metrics) - Monitor performance
