---
title: Zero-Copy Optimization
description: Performance optimizations in OSO Kafka Backup
sidebar_position: 5
---

# Zero-Copy Optimization

OSO Kafka Backup is built in Rust for maximum performance, employing various zero-copy and optimization techniques.

## What is Zero-Copy?

Zero-copy refers to techniques that minimize or eliminate data copying between memory locations:

```
Traditional Copy Path:
┌─────────────────────────────────────────────────────────────────────┐
│  Network Buffer → Kernel Buffer → User Buffer → Process Buffer      │
│       Copy 1          Copy 2          Copy 3                        │
│  Total: 3 copies per record                                         │
└─────────────────────────────────────────────────────────────────────┘

Zero-Copy Path:
┌─────────────────────────────────────────────────────────────────────┐
│  Network Buffer → User Buffer (mapped) → Process (reference)        │
│       Copy 1          No copy              No copy                  │
│  Total: 1 copy per record                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Rust Advantages

### Memory Safety Without GC

```rust
// Rust: Zero-cost abstractions
// No garbage collection pauses
// Predictable memory usage

// Example: Processing Kafka records
fn process_records(records: &[Record]) -> Result<()> {
    for record in records {
        // Borrow, don't copy
        let key = record.key();      // Reference, not copy
        let value = record.value();  // Reference, not copy

        // Process without allocation
        write_to_storage(key, value)?;
    }
    Ok(())
}
```

### Comparison with Java/JVM

| Aspect | Rust (OSO Kafka Backup) | Java (Typical) |
|--------|-------------------------|----------------|
| GC Pauses | None | Yes (can be 100ms+) |
| Memory overhead | ~0% | 30-50% (objects, GC) |
| Startup time | Instant | Seconds (JVM warmup) |
| Peak memory | Predictable | Variable |

## Performance Optimizations

### 1. Buffer Pooling

Reuse buffers instead of allocating new ones:

```
Without Pooling:
┌────────────────────────────────────────────────────────────────────┐
│  Record 1: allocate buffer → process → deallocate                   │
│  Record 2: allocate buffer → process → deallocate                   │
│  Record 3: allocate buffer → process → deallocate                   │
│  ...                                                                │
│  1 million records = 1 million allocations                          │
└────────────────────────────────────────────────────────────────────┘

With Pooling:
┌────────────────────────────────────────────────────────────────────┐
│  Get buffer from pool → process Record 1 → return to pool          │
│  Get buffer from pool → process Record 2 → return to pool          │
│  Get buffer from pool → process Record 3 → return to pool          │
│  ...                                                                │
│  1 million records = ~10 allocations (pool size)                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2. Streaming I/O

Process data as streams without buffering entire datasets:

```
Buffered Approach (Memory-Heavy):
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Read all records    Store in memory    Process all    Write all   │
│  (10 GB read)    →   (10 GB RAM)    →   (process)  →   (10 GB)     │
│                                                                     │
│  Memory usage: 10+ GB                                               │
└────────────────────────────────────────────────────────────────────┘

Streaming Approach (OSO Kafka Backup):
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Read batch   →   Process batch   →   Write batch   →   (repeat)   │
│  (100 MB)         (100 MB)            (100 MB)                      │
│                                                                     │
│  Memory usage: ~100 MB                                              │
└────────────────────────────────────────────────────────────────────┘
```

### 3. Async I/O

Non-blocking I/O for maximum throughput:

```
Synchronous (Blocking):
┌────────────────────────────────────────────────────────────────────┐
│  Thread 1:  Read ████░░░░░░░░░ Write ████░░░░░░░░░ Read ████       │
│             (Idle while waiting)                                    │
│                                                                     │
│  Throughput: Limited by sequential operations                       │
└────────────────────────────────────────────────────────────────────┘

Asynchronous (Non-Blocking):
┌────────────────────────────────────────────────────────────────────┐
│  Task 1:    Read ████████████████████████████████████████           │
│  Task 2:    ░░░░Write ████████████████████████████████████          │
│  Task 3:    ░░░░░░░░░Read ████████████████████████████████          │
│                                                                     │
│  Throughput: Limited by I/O bandwidth                               │
└────────────────────────────────────────────────────────────────────┘
```

Rust async implementation:

```rust
// Concurrent partition processing
async fn backup_partitions(partitions: Vec<Partition>) -> Result<()> {
    let futures: Vec<_> = partitions
        .into_iter()
        .map(|p| backup_partition(p))
        .collect();

    // Process all partitions concurrently
    join_all(futures).await?;
    Ok(())
}
```

### 4. SIMD Operations

Single Instruction, Multiple Data for compression:

```
Scalar Processing:
┌────────────────────────────────────────────────────────────────────┐
│  Process byte 0                                                     │
│  Process byte 1                                                     │
│  Process byte 2                                                     │
│  Process byte 3                                                     │
│  ... (one at a time)                                                │
└────────────────────────────────────────────────────────────────────┘

SIMD Processing:
┌────────────────────────────────────────────────────────────────────┐
│  Process bytes 0-31 simultaneously (256-bit registers)              │
│  Process bytes 32-63 simultaneously                                 │
│  ... (32 at a time with AVX2)                                       │
└────────────────────────────────────────────────────────────────────┘
```

Zstd uses SIMD automatically when available.

## Data Path Optimization

### Backup Data Path

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Optimized Backup Path                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Kafka Consumer                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Fetch batch (zero-copy from network buffer)                │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  Record Processor                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Iterate records (no copy, references only)                 │    │
│  │  Inject headers (minimal allocation)                        │    │
│  │  Serialize to batch format (streaming)                      │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  Compression                                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Stream compress (SIMD-accelerated)                         │    │
│  │  Output directly to storage buffer                          │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  Storage Writer                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Async write (non-blocking)                                 │    │
│  │  Multipart upload for large files                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Restore Data Path

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Optimized Restore Path                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Storage Reader                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Async read (prefetch next segment)                         │    │
│  │  Range requests for PITR (skip unnecessary data)            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  Decompression                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Stream decompress (SIMD-accelerated)                       │    │
│  │  Decompress faster than network can deliver                 │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  Record Parser                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Parse records (zero-copy views into buffer)                │    │
│  │  Apply PITR filter (skip without full parse)                │    │
│  │  Apply topic remapping (header modification only)           │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  Kafka Producer                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Batch produce (linger.ms optimization)                     │    │
│  │  Async send with backpressure                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Memory Layout Optimization

### Cache-Friendly Structures

```rust
// Cache-efficient: Contiguous memory
struct RecordBatch {
    offsets: Vec<i64>,       // Contiguous array
    timestamps: Vec<i64>,    // Contiguous array
    keys: Vec<Bytes>,        // Contiguous references
    values: Vec<Bytes>,      // Contiguous references
}

// Iteration is cache-friendly
for i in 0..batch.len() {
    process(batch.offsets[i], batch.values[i]);
}
```

### Avoiding Allocations

```rust
// Bad: Allocation per record
fn process_bad(records: &[Record]) -> Vec<ProcessedRecord> {
    records.iter()
        .map(|r| ProcessedRecord::new(r))  // Allocation!
        .collect()
}

// Good: In-place processing
fn process_good(records: &mut [Record]) {
    for record in records {
        record.process_in_place();  // No allocation
    }
}
```

## Network Optimization

### TCP Tuning

```yaml
# Optimal TCP settings for high-throughput
source:
  kafka_config:
    socket.receive.buffer.bytes: 1048576    # 1 MB receive buffer
    fetch.max.bytes: 52428800               # 50 MB max fetch
    fetch.min.bytes: 1048576                # 1 MB min (reduce round trips)
    fetch.max.wait.ms: 500                  # Wait for batches

target:
  kafka_config:
    socket.send.buffer.bytes: 1048576       # 1 MB send buffer
    batch.size: 1048576                     # 1 MB batches
    linger.ms: 100                          # Wait for batches
```

### Pipelining

```
Without Pipelining:
┌────────────────────────────────────────────────────────────────────┐
│  Request 1 → Wait → Response 1 → Request 2 → Wait → Response 2     │
│             ████                            ████                    │
│  Idle time: High                                                    │
└────────────────────────────────────────────────────────────────────┘

With Pipelining:
┌────────────────────────────────────────────────────────────────────┐
│  Request 1 → Request 2 → Request 3 → Response 1 → Response 2 → ... │
│                                                                     │
│  Idle time: Minimal                                                 │
└────────────────────────────────────────────────────────────────────┘
```

## Storage Optimization

### Multipart Uploads

Large files are uploaded in parallel parts:

```
Single Upload:
┌────────────────────────────────────────────────────────────────────┐
│  Upload 1 GB file: ████████████████████████████████ 60s            │
└────────────────────────────────────────────────────────────────────┘

Multipart Upload (10 parts):
┌────────────────────────────────────────────────────────────────────┐
│  Part 1: ████████ 6s                                                │
│  Part 2: ████████ 6s   (parallel)                                   │
│  Part 3: ████████ 6s   (parallel)                                   │
│  ...                                                                │
│  Total: ~10s (6x faster)                                            │
└────────────────────────────────────────────────────────────────────┘
```

Configuration:

```yaml
storage:
  backend: s3
  multipart_threshold: 104857600   # 100 MB
  multipart_part_size: 10485760    # 10 MB parts
  max_concurrent_uploads: 10
```

### Prefetching

Read-ahead for sequential access:

```
Without Prefetch:
┌────────────────────────────────────────────────────────────────────┐
│  Read segment 1 → Process → Read segment 2 → Process → ...         │
│                  (wait)                     (wait)                  │
└────────────────────────────────────────────────────────────────────┘

With Prefetch:
┌────────────────────────────────────────────────────────────────────┐
│  Read 1 → Process 1 → Process 2 → Process 3 → ...                  │
│  Read 2 ──────────────┘    │                                        │
│  Read 3 ───────────────────┘                                        │
│  (overlap read with process)                                        │
└────────────────────────────────────────────────────────────────────┘
```

## Benchmarks

### Throughput Comparison

Testing on AWS (c5.4xlarge, GP3 storage):

| Operation | OSO Kafka Backup | Typical Java Tool |
|-----------|------------------|-------------------|
| Backup (1 partition) | 150 MB/s | 40 MB/s |
| Backup (10 partitions) | 1.2 GB/s | 300 MB/s |
| Restore (1 partition) | 200 MB/s | 60 MB/s |
| Restore (10 partitions) | 1.5 GB/s | 400 MB/s |

### Memory Usage

| Dataset Size | OSO Kafka Backup | Typical Java Tool |
|--------------|------------------|-------------------|
| 1 GB backup | 100 MB | 1.5 GB |
| 10 GB backup | 150 MB | 4 GB |
| 100 GB backup | 200 MB | 16 GB+ |

### Latency Percentiles

Backup operation latency (per batch):

| Percentile | OSO Kafka Backup | Typical Java Tool |
|------------|------------------|-------------------|
| p50 | 2 ms | 10 ms |
| p99 | 8 ms | 50 ms |
| p99.9 | 15 ms | 200 ms |

## Configuration for Maximum Performance

### High-Throughput Configuration

```yaml
source:
  kafka_config:
    fetch.max.bytes: 104857600          # 100 MB
    max.partition.fetch.bytes: 10485760  # 10 MB per partition
    fetch.min.bytes: 1048576             # 1 MB minimum

backup:
  batch_size: 100000                     # Large batches
  max_batch_bytes: 104857600             # 100 MB max
  compression: zstd
  compression_level: 1                   # Fast compression
  checkpoint_interval_secs: 60           # Less frequent checkpoints

storage:
  multipart_threshold: 52428800          # 50 MB
  multipart_part_size: 10485760          # 10 MB
  max_concurrent_uploads: 20
```

### Low-Latency Configuration

```yaml
source:
  kafka_config:
    fetch.max.wait.ms: 100               # Don't wait too long

backup:
  batch_size: 10000                      # Smaller batches
  max_batch_bytes: 10485760              # 10 MB max
  compression: lz4                       # Fastest compression
  checkpoint_interval_secs: 10           # Frequent checkpoints
```

## Monitoring Performance

### Key Metrics

```promql
# Records per second
rate(kafka_backup_records_total[5m])

# Bytes per second
rate(kafka_backup_bytes_total[5m])

# Batch processing time
histogram_quantile(0.99, kafka_backup_batch_duration_seconds_bucket)

# Memory usage
process_resident_memory_bytes
```

### Identifying Bottlenecks

```
If records/sec is low but CPU is low:
  → Bottleneck is I/O (network or storage)
  → Increase batch sizes, parallelism

If records/sec is low and CPU is high:
  → Bottleneck is compression
  → Reduce compression level or use LZ4

If memory is growing:
  → Backpressure not working correctly
  → Reduce batch sizes
```

## Next Steps

- [Performance Tuning Guide](../guides/performance-tuning) - Practical optimization
- [Compression](./compression) - Algorithm tuning
- [Metrics Reference](../reference/metrics) - All performance metrics
