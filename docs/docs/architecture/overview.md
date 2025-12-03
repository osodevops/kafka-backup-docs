---
title: Architecture Overview
description: Understanding the OSO Kafka Backup architecture and design principles
sidebar_position: 1
---

# Architecture Overview

OSO Kafka Backup is designed for high-performance, reliable Kafka data protection with minimal operational overhead.

## Design Principles

### 1. Performance First

Built in Rust for maximum throughput:

- **Zero-copy data paths** where possible
- **Async I/O** throughout the pipeline
- **Parallel processing** across partitions
- **Streaming architecture** - no full dataset buffering

### 2. Data Integrity

Every operation ensures data integrity:

- **Checksums** at multiple levels
- **Atomic writes** to storage
- **Transactional commits** with checkpoints
- **Validation tools** for verification

### 3. Operational Simplicity

Designed for easy operation:

- **Single binary** - no dependencies
- **YAML configuration** - declarative and version-controllable
- **Kubernetes-native** - CRDs and operators
- **Comprehensive CLI** - all operations accessible

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OSO Kafka Backup                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   Backup     │    │   Restore    │    │   Offset     │               │
│  │   Engine     │    │   Engine     │    │   Manager    │               │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘               │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Core Library                                  │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │    │
│  │  │ Kafka   │  │ Storage │  │ Compress│  │ Crypto  │             │    │
│  │  │ Client  │  │ Backend │  │ Pipeline│  │ Module  │             │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  Kafka   │        │  Object  │        │  Local   │
   │  Cluster │        │  Storage │        │  Storage │
   └──────────┘        └──────────┘        └──────────┘
```

## Components

### Backup Engine

Responsible for reading data from Kafka and writing to storage:

```
Kafka Partitions          Backup Engine              Storage
┌───────────────┐    ┌─────────────────────┐    ┌──────────────┐
│ Partition 0   │───▶│ Consumer Thread 0   │───▶│              │
├───────────────┤    ├─────────────────────┤    │              │
│ Partition 1   │───▶│ Consumer Thread 1   │───▶│   Segment    │
├───────────────┤    ├─────────────────────┤    │   Files      │
│ Partition 2   │───▶│ Consumer Thread 2   │───▶│              │
└───────────────┘    └─────────────────────┘    └──────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │  Checkpoint Manager │
                     │  (Progress Tracking)│
                     └─────────────────────┘
```

**Key features:**
- Parallel consumption across partitions
- Configurable batch sizes
- Checkpoint-based progress tracking
- Graceful shutdown with state preservation

### Restore Engine

Responsible for reading from storage and writing to Kafka:

```
Storage                  Restore Engine              Kafka Partitions
┌──────────────┐    ┌─────────────────────┐    ┌───────────────┐
│              │───▶│ Reader Thread 0     │───▶│ Partition 0   │
│              │    ├─────────────────────┤    ├───────────────┤
│   Segment    │───▶│ Reader Thread 1     │───▶│ Partition 1   │
│   Files      │    ├─────────────────────┤    ├───────────────┤
│              │───▶│ Reader Thread 2     │───▶│ Partition 2   │
└──────────────┘    └─────────────────────┘    └───────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │   Offset Header     │
                     │   Injection         │
                     └─────────────────────┘
```

**Key features:**
- PITR filtering by timestamp
- Topic and partition remapping
- Original offset preservation in headers
- Idempotent writes support

### Offset Manager

Handles consumer group offset translation:

```
┌─────────────────────────────────────────────────────────────┐
│                     Offset Manager                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Mapping   │───▶│  Strategy   │───▶│   Reset     │      │
│  │   Builder   │    │  Resolver   │    │   Executor  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                                     │              │
│         ▼                                     ▼              │
│  ┌─────────────┐                      ┌─────────────┐       │
│  │   Header    │                      │   Kafka     │       │
│  │   Scanner   │                      │   Admin     │       │
│  └─────────────┘                      └─────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- Multiple reset strategies
- Parallel bulk operations
- Snapshot and rollback support
- Verification tools

### Storage Backend

Abstraction layer for different storage systems:

```
┌─────────────────────────────────────────────────────────────┐
│                   Storage Backend Interface                  │
├─────────────────────────────────────────────────────────────┤
│  pub trait StorageBackend {                                  │
│      fn put(&self, key: &str, data: &[u8]) -> Result<()>;   │
│      fn get(&self, key: &str) -> Result<Vec<u8>>;           │
│      fn list(&self, prefix: &str) -> Result<Vec<String>>;   │
│      fn delete(&self, key: &str) -> Result<()>;             │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
    │   S3    │   │  Azure  │   │   GCS   │   │  Local  │
    │ Backend │   │ Backend │   │ Backend │   │ Backend │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

## Data Flow

### Backup Flow

```
1. Initialize
   ├── Parse configuration
   ├── Connect to Kafka
   ├── Discover partitions
   └── Load checkpoint (if resuming)

2. Consume
   ├── Fetch records from Kafka
   ├── Batch records
   └── Apply compression

3. Store
   ├── Write segment file
   ├── Update manifest
   └── Save checkpoint

4. Finalize
   ├── Flush pending data
   ├── Write final manifest
   └── Close connections
```

### Restore Flow

```
1. Initialize
   ├── Parse configuration
   ├── Load backup manifest
   ├── Connect to target Kafka
   └── Create topics (if needed)

2. Filter
   ├── Apply time window (PITR)
   ├── Apply topic selection
   └── Apply partition mapping

3. Produce
   ├── Read segment files
   ├── Decompress records
   ├── Inject offset headers
   └── Write to Kafka

4. Finalize
   ├── Flush producers
   ├── Generate offset mapping
   └── Close connections
```

## Concurrency Model

### Backup Concurrency

```
Main Thread
     │
     ├──▶ Partition Consumer 0 ──▶ Compression ──▶ Storage Writer
     │
     ├──▶ Partition Consumer 1 ──▶ Compression ──▶ Storage Writer
     │
     ├──▶ Partition Consumer 2 ──▶ Compression ──▶ Storage Writer
     │
     └──▶ Checkpoint Thread (periodic)
```

- Each partition has dedicated consumer
- Compression happens in parallel
- Storage writes are batched and pipelined
- Checkpoint updates are asynchronous

### Restore Concurrency

```
Main Thread
     │
     ├──▶ Segment Reader 0 ──▶ Decompression ──▶ Producer Pool
     │
     ├──▶ Segment Reader 1 ──▶ Decompression ──▶ Producer Pool
     │
     └──▶ Progress Reporter (periodic)
```

- Multiple segment readers in parallel
- Shared producer pool for Kafka writes
- Backpressure handling to prevent memory overflow

## Memory Management

### Bounded Memory Usage

```yaml
# Memory constraints
backup:
  batch_size: 10000            # Max records per batch
  max_batch_bytes: 104857600   # 100 MB max batch size

storage:
  buffer_size: 16777216        # 16 MB write buffer
```

### Streaming Processing

Data flows through the system without full buffering:

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Read   │───▶│ Process │───▶│ Compress│───▶│  Write  │
│ (Kafka) │    │ (Memory)│    │ (Stream)│    │(Storage)│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │
                   ▼
              Bounded Buffer
              (configurable)
```

## Error Handling

### Retry Strategy

```
┌─────────────────────────────────────────────────────┐
│                 Error Classification                 │
├─────────────────────────────────────────────────────┤
│  Transient         │  Retry with backoff            │
│  - Network timeout │  - Exponential backoff         │
│  - Rate limited    │  - Max retries configurable    │
├────────────────────┼────────────────────────────────┤
│  Recoverable       │  Checkpoint and resume         │
│  - Partial failure │  - Resume from checkpoint      │
│  - Process restart │  - No data loss                │
├────────────────────┼────────────────────────────────┤
│  Fatal             │  Fail with clear error         │
│  - Auth failure    │  - Detailed error message      │
│  - Invalid config  │  - Exit with error code        │
└────────────────────┴────────────────────────────────┘
```

### Circuit Breaker

For handling sustained failures:

```yaml
backup:
  circuit_breaker:
    failure_threshold: 5      # Failures before opening
    reset_timeout_secs: 60    # Time before retry
    half_open_requests: 3     # Test requests when half-open
```

## Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layer                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Kafka Authentication                                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │    SASL     │    │    TLS      │    │    mTLS     │      │
│  │  (Various)  │    │ (Encryption)│    │  (Mutual)   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                              │
│  Storage Authentication                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  IAM Role   │    │ Service     │    │   Static    │      │
│  │  (AWS/GCP)  │    │ Principal   │    │   Keys      │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Encryption

- **In Transit**: TLS 1.2+ for all connections
- **At Rest**: Storage-native encryption (SSE-S3, SSE-KMS, Azure encryption)
- **Field-Level**: Enterprise feature for sensitive data

## Observability

### Metrics Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Metrics Collection                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Counter   │    │   Gauge     │    │  Histogram  │      │
│  │  (Records)  │    │  (Progress) │    │  (Latency)  │      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │   Prometheus    │                        │
│                   │   Exporter      │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Prometheus    │
                    │   /metrics      │
                    └─────────────────┘
```

## Next Steps

- [Offset Translation](./offset-translation) - How offset mapping works
- [PITR Implementation](./pitr-implementation) - Point-in-time recovery details
- [Compression](./compression) - Compression algorithms and tuning
- [Zero-Copy Optimization](./zero-copy-optimization) - Performance optimizations
