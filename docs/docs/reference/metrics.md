---
title: Metrics Reference
description: OSO Kafka Backup Prometheus metrics reference
sidebar_position: 5
---

# Metrics Reference

OSO Kafka Backup exposes Prometheus metrics for monitoring backup and restore operations.

## Metrics Endpoint

When running as a service or operator, metrics are exposed at:

```
http://localhost:8080/metrics
```

## CLI Metrics

The CLI reports metrics to stdout at the end of operations:

```
Backup completed successfully
────────────────────────────────
Records:     2,456,789
Duration:    5m 32s
Throughput:  7,423 records/sec
Compressed:  245 MB (4.9x ratio)
```

---

## Backup Metrics

### kafka_backup_records_total

**Type:** Counter

Total number of records backed up.

**Labels:**
- `topic` - Topic name
- `partition` - Partition number
- `backup_id` - Backup identifier

**Example:**
```
kafka_backup_records_total{topic="orders",partition="0",backup_id="daily-001"} 150234
```

### kafka_backup_bytes_total

**Type:** Counter

Total bytes backed up (uncompressed).

**Labels:**
- `topic` - Topic name
- `partition` - Partition number
- `backup_id` - Backup identifier

**Example:**
```
kafka_backup_bytes_total{topic="orders",partition="0",backup_id="daily-001"} 52428800
```

### kafka_backup_compressed_bytes_total

**Type:** Counter

Total bytes written to storage (compressed).

**Labels:**
- `topic` - Topic name
- `backup_id` - Backup identifier

**Example:**
```
kafka_backup_compressed_bytes_total{topic="orders",backup_id="daily-001"} 10485760
```

### kafka_backup_segments_total

**Type:** Counter

Total number of segment files created.

**Labels:**
- `topic` - Topic name
- `partition` - Partition number
- `backup_id` - Backup identifier

### kafka_backup_duration_seconds

**Type:** Histogram

Backup operation duration in seconds.

**Labels:**
- `backup_id` - Backup identifier
- `status` - `success` or `failure`

**Buckets:** 1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600

**Example:**
```
kafka_backup_duration_seconds_bucket{backup_id="daily-001",status="success",le="300"} 1
kafka_backup_duration_seconds_sum{backup_id="daily-001",status="success"} 332.5
kafka_backup_duration_seconds_count{backup_id="daily-001",status="success"} 1
```

### kafka_backup_throughput_records_per_second

**Type:** Gauge

Current backup throughput (records per second).

**Labels:**
- `backup_id` - Backup identifier

### kafka_backup_throughput_bytes_per_second

**Type:** Gauge

Current backup throughput (bytes per second).

**Labels:**
- `backup_id` - Backup identifier

### kafka_backup_lag_records

**Type:** Gauge

Number of records behind the high watermark.

**Labels:**
- `topic` - Topic name
- `partition` - Partition number
- `backup_id` - Backup identifier

### kafka_backup_compression_ratio

**Type:** Gauge

Compression ratio (uncompressed / compressed).

**Labels:**
- `backup_id` - Backup identifier
- `algorithm` - Compression algorithm (zstd, lz4, none)

**Example:**
```
kafka_backup_compression_ratio{backup_id="daily-001",algorithm="zstd"} 4.9
```

---

## Restore Metrics

### kafka_restore_records_total

**Type:** Counter

Total number of records restored.

**Labels:**
- `topic` - Target topic name
- `partition` - Target partition
- `backup_id` - Source backup identifier

### kafka_restore_bytes_total

**Type:** Counter

Total bytes restored.

**Labels:**
- `topic` - Target topic name
- `backup_id` - Source backup identifier

### kafka_restore_duration_seconds

**Type:** Histogram

Restore operation duration.

**Labels:**
- `backup_id` - Source backup identifier
- `status` - `success` or `failure`

**Buckets:** 1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600

### kafka_restore_progress_percent

**Type:** Gauge

Restore progress percentage (0-100).

**Labels:**
- `backup_id` - Source backup identifier

### kafka_restore_throughput_records_per_second

**Type:** Gauge

Current restore throughput.

**Labels:**
- `backup_id` - Source backup identifier

### kafka_restore_eta_seconds

**Type:** Gauge

Estimated time remaining for restore.

**Labels:**
- `backup_id` - Source backup identifier

---

## Offset Reset Metrics

### kafka_offset_reset_partitions_total

**Type:** Counter

Total partitions where offsets were reset.

**Labels:**
- `consumer_group` - Consumer group name
- `status` - `success` or `failure`

### kafka_offset_reset_duration_seconds

**Type:** Histogram

Offset reset operation duration.

**Labels:**
- `consumer_group` - Consumer group name
- `status` - `success` or `failure`

**Buckets:** 0.5, 1, 2.5, 5, 10, 30, 60, 120

### kafka_offset_reset_latency_seconds

**Type:** Histogram

Per-partition offset reset latency.

**Labels:**
- `consumer_group` - Consumer group name
- `quantile` - p50, p90, p99

---

## Error Metrics

### kafka_backup_errors_total

**Type:** Counter

Total number of errors encountered.

**Labels:**
- `operation` - `backup`, `restore`, `validate`, `offset_reset`
- `error_type` - Error category (see [Error Codes](./error-codes))

**Example:**
```
kafka_backup_errors_total{operation="backup",error_type="KAFKA_CONNECTION_FAILED"} 2
```

### kafka_backup_retries_total

**Type:** Counter

Total number of retry attempts.

**Labels:**
- `operation` - Operation type
- `reason` - Retry reason

---

## Storage Metrics

### kafka_backup_storage_write_bytes_total

**Type:** Counter

Total bytes written to storage.

**Labels:**
- `backend` - Storage backend (filesystem, s3, azure, gcs)
- `backup_id` - Backup identifier

### kafka_backup_storage_write_latency_seconds

**Type:** Histogram

Storage write latency.

**Labels:**
- `backend` - Storage backend
- `operation` - `segment`, `manifest`, `checkpoint`

**Buckets:** 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

### kafka_backup_storage_read_bytes_total

**Type:** Counter

Total bytes read from storage.

**Labels:**
- `backend` - Storage backend
- `backup_id` - Backup identifier

---

## Operator Metrics

When running as a Kubernetes operator, additional metrics are exposed:

### kafka_backup_operator_reconciliations_total

**Type:** Counter

Total reconciliation loops.

**Labels:**
- `kind` - Resource kind (KafkaBackup, KafkaRestore, etc.)
- `result` - `success`, `failure`, `requeue`

### kafka_backup_operator_reconciliation_errors_total

**Type:** Counter

Total reconciliation errors.

**Labels:**
- `kind` - Resource kind

### kafka_backup_operator_reconcile_duration_seconds

**Type:** Histogram

Reconciliation loop duration.

**Labels:**
- `kind` - Resource kind

**Buckets:** 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10

### kafka_backup_operator_managed_resources

**Type:** Gauge

Number of managed resources by type.

**Labels:**
- `kind` - Resource kind

### kafka_backup_operator_health

**Type:** Gauge

Operator health status (1 = healthy, 0 = unhealthy).

---

## Grafana Dashboard

### Recommended Panels

#### Backup Overview

```promql
# Backup throughput
rate(kafka_backup_records_total[5m])

# Compression ratio
kafka_backup_compression_ratio

# Active backups
count(kafka_backup_throughput_records_per_second > 0)
```

#### Restore Progress

```promql
# Progress percentage
kafka_restore_progress_percent

# ETA
kafka_restore_eta_seconds

# Throughput
kafka_restore_throughput_records_per_second
```

#### Error Rates

```promql
# Error rate
rate(kafka_backup_errors_total[5m])

# Retry rate
rate(kafka_backup_retries_total[5m])
```

### Alert Rules

```yaml
groups:
  - name: kafka-backup
    rules:
      - alert: BackupFailed
        expr: increase(kafka_backup_errors_total{operation="backup"}[1h]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Kafka backup failed"
          description: "Backup {{ $labels.backup_id }} has failed"

      - alert: BackupLagging
        expr: kafka_backup_lag_records > 100000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Backup is lagging"
          description: "Backup {{ $labels.backup_id }} is {{ $value }} records behind"

      - alert: LowCompressionRatio
        expr: kafka_backup_compression_ratio < 2
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low compression ratio"
          description: "Compression ratio is only {{ $value }}x"
```

---

## Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'kafka-backup'
    static_configs:
      - targets: ['kafka-backup:8080']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: 'kafka-backup-operator'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: kafka-backup-operator
        action: keep
```

## ServiceMonitor (Prometheus Operator)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kafka-backup-operator
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: kafka-backup-operator
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
```
