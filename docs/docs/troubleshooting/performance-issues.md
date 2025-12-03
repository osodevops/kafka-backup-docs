---
title: Performance Issues
description: Troubleshooting slow backup and restore operations
sidebar_position: 2
---

# Performance Issues

This guide helps diagnose and resolve slow backup and restore operations.

## Diagnosing Performance Problems

### Check Current Throughput

```bash
# Monitor backup progress
kafka-backup status --config backup.yaml --watch

# Output includes:
# Records/sec: 50,000
# Bytes/sec: 25 MB/s
# Estimated completion: 2h 15m
```

### Expected Performance

| Operation | Per Partition | With 10 Partitions |
|-----------|---------------|-------------------|
| Backup | 50-100 MB/s | 500 MB/s - 1 GB/s |
| Restore | 75-150 MB/s | 750 MB/s - 1.5 GB/s |

If you're seeing significantly lower numbers, continue troubleshooting.

## Backup Performance

### Problem: Slow Kafka Consumption

**Symptoms:**
- Low records/sec
- High CPU idle
- Storage I/O is fine

**Diagnosis:**

```bash
# Check consumer lag
kafka-consumer-groups --bootstrap-server kafka:9092 \
  --describe --group kafka-backup-$BACKUP_ID
```

**Solutions:**

```yaml
# Increase fetch sizes
source:
  kafka_config:
    fetch.max.bytes: 104857600          # 100 MB
    max.partition.fetch.bytes: 10485760  # 10 MB per partition
    fetch.min.bytes: 1048576             # 1 MB minimum
    fetch.max.wait.ms: 500               # Wait for batches
```

### Problem: Network Bottleneck

**Symptoms:**
- Throughput limited regardless of settings
- Network utilization at 100%

**Diagnosis:**

```bash
# Check network utilization
iftop -i eth0

# Test network bandwidth
iperf3 -c kafka-broker-0 -p 5201
```

**Solutions:**

1. **Compress before transfer:**
```yaml
backup:
  compression: zstd
  compression_level: 1  # Fast compression
```

2. **Use closer storage region:**
```yaml
storage:
  backend: s3
  region: us-west-2  # Same region as Kafka
```

3. **Enable VPC endpoints:**
```yaml
storage:
  backend: s3
  endpoint: https://s3.us-west-2.amazonaws.com
  use_vpc_endpoint: true
```

### Problem: Slow Compression

**Symptoms:**
- High CPU utilization
- Compression taking most of the time

**Diagnosis:**

```bash
# Check CPU during backup
top -p $(pgrep kafka-backup)

# Check metrics
curl localhost:9090/metrics | grep compression
```

**Solutions:**

```yaml
# Use faster compression
backup:
  compression: lz4  # Faster than zstd
  # Or reduce level
  compression: zstd
  compression_level: 1  # Fastest
```

### Problem: Slow Storage Writes

**Symptoms:**
- Low storage throughput
- High storage latency

**Diagnosis:**

```bash
# Test S3 write speed
dd if=/dev/zero bs=1M count=100 | aws s3 cp - s3://bucket/test-file

# Check CloudWatch metrics for S3
```

**Solutions:**

```yaml
# Optimize multipart uploads
storage:
  backend: s3
  multipart_threshold: 52428800    # 50 MB
  multipart_part_size: 10485760    # 10 MB
  max_concurrent_uploads: 10
```

### Problem: Single Partition Bottleneck

**Symptoms:**
- One partition much slower than others
- Uneven partition sizes

**Diagnosis:**

```bash
# Check partition sizes
kafka-log-dirs --bootstrap-server kafka:9092 --describe
```

**Solutions:**

1. For future: Use better partition keys
2. For now: Accept longer backup time for skewed partitions

## Restore Performance

### Problem: Slow Kafka Production

**Symptoms:**
- Low write throughput
- Producer backpressure

**Diagnosis:**

```bash
# Check producer metrics
kafka-backup status --config restore.yaml --watch
```

**Solutions:**

```yaml
# Optimize producer settings
target:
  kafka_config:
    batch.size: 1048576        # 1 MB batches
    linger.ms: 100             # Wait for batches
    buffer.memory: 67108864    # 64 MB buffer
    acks: 1                    # Trade durability for speed
    compression.type: lz4      # Producer-side compression
```

### Problem: Slow Decompression

**Symptoms:**
- Reading from storage is fine
- CPU bound during restore

**Solutions:**

```yaml
# Use faster decompression (for future backups)
backup:
  compression: lz4  # Decompresses faster than zstd
```

### Problem: Slow PITR Filtering

**Symptoms:**
- PITR restore much slower than full restore
- Many segments being read but few records restored

**Diagnosis:**

```bash
# Check how many records match time window
kafka-backup describe \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --format json | jq '.segments[] | select(.start_timestamp < 1701388800000)'
```

**Solutions:**

```yaml
# Ensure time window aligns with segment boundaries
# Backups with shorter checkpoint intervals = better PITR performance
backup:
  checkpoint_interval_secs: 30  # More granular segments
```

## Resource Optimization

### Memory Tuning

```yaml
# Reduce memory for constrained environments
backup:
  batch_size: 10000           # Fewer records per batch
  max_batch_bytes: 52428800   # 50 MB max

# Increase memory for better throughput
backup:
  batch_size: 100000          # More records per batch
  max_batch_bytes: 209715200  # 200 MB max
```

### CPU Tuning

```yaml
# Reduce CPU usage
backup:
  compression: lz4           # Lower CPU
  compression_level: 1

# Maximize throughput (more CPU)
backup:
  compression: zstd
  compression_level: 3
  # Parallel compression across partitions
```

### Parallelism

```yaml
# More parallelism (higher resource usage)
backup:
  parallel_partitions: 20    # Process more partitions concurrently

# Less parallelism (lower resource usage)
backup:
  parallel_partitions: 4
```

## Storage-Specific Optimization

### S3 Performance

```yaml
storage:
  backend: s3
  bucket: my-bucket
  region: us-west-2

  # Transfer acceleration
  use_accelerate_endpoint: true

  # Multipart optimization
  multipart_threshold: 52428800
  multipart_part_size: 10485760
  max_concurrent_uploads: 20

  # Connection pooling
  max_connections: 50
```

### Azure Blob Performance

```yaml
storage:
  backend: azure
  container: kafka-backups

  # Block blob settings
  block_size: 10485760      # 10 MB blocks
  max_concurrency: 10
```

### GCS Performance

```yaml
storage:
  backend: gcs
  bucket: kafka-backups

  # Parallel composite uploads
  parallel_composite_upload: true
  chunk_size: 10485760      # 10 MB chunks
```

### Local/PVC Performance

```yaml
storage:
  backend: local
  path: /backups

  # Use SSD if available
  # Ensure sufficient IOPS
```

## Monitoring Performance

### Prometheus Metrics

```promql
# Backup throughput
rate(kafka_backup_bytes_total[5m])

# Records per second
rate(kafka_backup_records_total[5m])

# Compression ratio
kafka_backup_compression_ratio

# Batch processing time (p99)
histogram_quantile(0.99, kafka_backup_batch_duration_seconds_bucket)
```

### Grafana Dashboard

Key panels to monitor:
- Throughput (MB/s) over time
- Records/sec per partition
- Compression ratio
- Checkpoint latency
- Storage write latency

### Real-time Monitoring

```bash
# Watch backup progress
kafka-backup backup --config backup.yaml --progress

# Output:
# Progress: 45% (450,000/1,000,000 records)
# Speed: 85 MB/s
# ETA: 10 minutes
```

## Performance Checklist

### Before Backup

- [ ] Kafka cluster has capacity for backup consumer
- [ ] Storage bucket is in same region as Kafka
- [ ] Network allows sufficient bandwidth
- [ ] Compression level matches needs (speed vs size)

### During Backup

- [ ] Monitor throughput metrics
- [ ] Check for consumer lag
- [ ] Verify checkpoint writes succeeding
- [ ] Watch for rate limiting errors

### After Backup

- [ ] Verify backup size is reasonable
- [ ] Check compression ratio
- [ ] Note total duration for planning
- [ ] Run validation

## Benchmarking

### Baseline Test

```bash
# Test maximum throughput to storage
dd if=/dev/zero bs=1M count=1000 | \
  aws s3 cp - s3://bucket/benchmark/test-1gb

# Test maximum throughput from Kafka
kafka-consumer-perf-test \
  --bootstrap-server kafka:9092 \
  --topic orders \
  --messages 1000000 \
  --threads 4
```

### Compare Configurations

```bash
# Test with different compression
for level in 1 3 6 9; do
  kafka-backup backup \
    --config backup.yaml \
    --compression-level $level \
    --dry-run \
    --benchmark
done
```

## Next Steps

- [Debug Mode](./debug-mode) - Enable verbose logging
- [Performance Tuning Guide](../guides/performance-tuning) - Optimization strategies
- [Architecture](../architecture/zero-copy-optimization) - Understanding internals
