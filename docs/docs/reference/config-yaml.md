---
title: Configuration Reference
description: Complete reference for OSO Kafka Backup YAML configuration files
sidebar_position: 2
---

# Configuration Reference

OSO Kafka Backup uses YAML configuration files for backup and restore operations. This reference documents all available options.

## Configuration Structure

```yaml
# Required: Operation mode
mode: backup  # or "restore"

# Required: Unique backup identifier
backup_id: "my-backup-001"

# Source/Target Kafka cluster configuration
source:  # For backup mode
target:  # For restore mode
  bootstrap_servers: []
  security: {}
  topics: {}

# Storage backend configuration
storage:
  backend: filesystem  # or s3, azure, gcs
  # Backend-specific options...

# Mode-specific options
backup: {}   # Backup options
restore: {}  # Restore options
```

---

## Common Configuration

### mode

**Required.** Operation mode.

```yaml
mode: backup   # Run a backup operation
mode: restore  # Run a restore operation
```

### backup_id

**Required.** Unique identifier for the backup.

```yaml
backup_id: "production-daily-001"
backup_id: "dr-backup-$(date +%Y%m%d)"
```

---

## Kafka Cluster Configuration

Used as `source` in backup mode and `target` in restore mode.

### bootstrap_servers

**Required.** List of Kafka broker addresses.

```yaml
source:
  bootstrap_servers:
    - broker-1.kafka.svc:9092
    - broker-2.kafka.svc:9092
    - broker-3.kafka.svc:9092
```

### security

Optional security configuration for Kafka connection.

```yaml
source:
  security:
    # Security protocol
    security_protocol: SASL_SSL  # PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL

    # SASL configuration
    sasl_mechanism: SCRAM-SHA-256  # PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
    sasl_username: backup-user
    sasl_password: ${KAFKA_PASSWORD}  # Environment variable substitution

    # SSL/TLS configuration
    ssl_ca_location: /etc/kafka/ca.crt
    ssl_certificate_location: /etc/kafka/client.crt
    ssl_key_location: /etc/kafka/client.key
    ssl_key_password: ${SSL_KEY_PASSWORD}
```

#### Security Protocol Options

| Protocol | Description |
|----------|-------------|
| `PLAINTEXT` | No encryption, no authentication |
| `SSL` | TLS encryption, optional mTLS |
| `SASL_PLAINTEXT` | SASL authentication, no encryption |
| `SASL_SSL` | SASL authentication with TLS encryption |

#### SASL Mechanism Options

| Mechanism | Description |
|-----------|-------------|
| `PLAIN` | Simple username/password |
| `SCRAM-SHA-256` | Salted Challenge Response (SHA-256) |
| `SCRAM-SHA-512` | Salted Challenge Response (SHA-512) |

### topics

Topic selection for backup or restore.

```yaml
source:
  topics:
    # Include specific topics or patterns
    include:
      - orders              # Exact topic name
      - payments            # Another exact name
      - "events-*"          # Wildcard pattern
      - "logs-2024-*"       # Date-based pattern

    # Exclude topics (applied after include)
    exclude:
      - "__consumer_offsets"  # Internal Kafka topic
      - "_schemas"            # Schema Registry topic
      - "*-internal"          # Pattern exclusion
```

---

## Storage Configuration

### backend

**Required.** Storage backend type.

```yaml
storage:
  backend: filesystem  # Local filesystem or mounted volume
  backend: s3          # Amazon S3 or S3-compatible storage
  backend: azure       # Azure Blob Storage
  backend: gcs         # Google Cloud Storage
```

### Filesystem Storage

```yaml
storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"
  prefix: "cluster-prod"  # Optional subdirectory
```

### S3 Storage

```yaml
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  prefix: backups/production  # Optional key prefix

  # Optional: Custom endpoint for MinIO, Ceph, etc.
  endpoint: https://minio.example.com:9000

  # Credentials (optional - uses AWS credential chain if not specified)
  access_key: ${AWS_ACCESS_KEY_ID}
  secret_key: ${AWS_SECRET_ACCESS_KEY}
```

### Azure Blob Storage

```yaml
storage:
  backend: azure
  container: kafka-backups
  account_name: mystorageaccount
  prefix: backups/production

  # Credentials
  account_key: ${AZURE_STORAGE_KEY}
  # Or use connection string:
  # connection_string: ${AZURE_STORAGE_CONNECTION_STRING}
```

### Google Cloud Storage

```yaml
storage:
  backend: gcs
  bucket: my-kafka-backups
  prefix: backups/production

  # Credentials (uses GOOGLE_APPLICATION_CREDENTIALS if not specified)
  service_account_json: /etc/gcp/service-account.json
```

---

## Backup Configuration

Options specific to backup mode.

```yaml
backup:
  # Compression settings
  compression: zstd           # Options: zstd, lz4, none
  compression_level: 3        # 1-22 for zstd (default: 3)

  # Starting offset
  start_offset: earliest      # earliest, latest, or specific offset

  # Segment settings
  segment_max_bytes: 134217728     # 128 MB - roll segment after this size
  segment_max_interval_ms: 60000   # 60 sec - roll segment after this time

  # Continuous backup mode
  continuous: false           # true for streaming backup

  # Internal topics
  include_internal_topics: false  # Include __consumer_offsets, etc.

  # Checkpointing
  checkpoint_interval_secs: 30    # Save progress every 30 seconds
  sync_interval_secs: 60          # Sync to storage every 60 seconds

  # Offset headers (required for consumer offset reset)
  include_offset_headers: true

  # Source cluster identifier
  source_cluster_id: "prod-cluster-east"
```

### Backup Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `compression` | string | `zstd` | Compression algorithm |
| `compression_level` | int | `3` | Compression level (1-22 for zstd) |
| `start_offset` | string | `earliest` | Starting offset: `earliest`, `latest` |
| `segment_max_bytes` | int | `134217728` | Max segment size in bytes |
| `segment_max_interval_ms` | int | `60000` | Max segment duration in ms |
| `continuous` | bool | `false` | Enable continuous/streaming backup |
| `include_internal_topics` | bool | `false` | Include internal Kafka topics |
| `checkpoint_interval_secs` | int | `30` | Checkpoint frequency |
| `sync_interval_secs` | int | `60` | Storage sync frequency |
| `include_offset_headers` | bool | `true` | Store original offsets |
| `source_cluster_id` | string | - | Cluster identifier for tracking |

---

## Restore Configuration

Options specific to restore mode.

```yaml
restore:
  # Point-in-Time Recovery (PITR)
  time_window_start: 1701417600000  # Unix milliseconds (optional)
  time_window_end: 1701504000000    # Unix milliseconds (optional)

  # Partition filtering
  source_partitions:              # Only restore specific partitions
    - 0
    - 1
    - 2

  # Partition mapping (remap partitions during restore)
  partition_mapping:
    0: 0
    1: 2    # Source partition 1 -> target partition 2

  # Topic remapping
  topic_mapping:
    orders: orders_restored       # orders -> orders_restored
    payments: payments_dr         # payments -> payments_dr

  # Consumer offset strategy
  consumer_group_strategy: skip   # skip, header-based, timestamp-based, manual

  # Dry run mode
  dry_run: false                  # Validate without executing

  # Include original offset in headers
  include_original_offset_header: true

  # Rate limiting
  rate_limit_records_per_sec: null  # null for unlimited
  rate_limit_bytes_per_sec: null    # null for unlimited

  # Performance tuning
  max_concurrent_partitions: 4      # Parallel partition processing
  produce_batch_size: 1000          # Records per produce batch

  # Resumable restores
  checkpoint_state: null            # Path to checkpoint file
  checkpoint_interval_secs: 60      # Checkpoint frequency

  # Offset mapping report
  offset_report: /tmp/offset-mapping.json  # Save offset mapping

  # Consumer group offset reset
  reset_consumer_offsets: false     # Reset offsets after restore
  consumer_groups:                  # Groups to reset
    - my-consumer-group
    - analytics-consumer
```

### Restore Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `time_window_start` | int | - | PITR start timestamp (Unix ms) |
| `time_window_end` | int | - | PITR end timestamp (Unix ms) |
| `source_partitions` | list | - | Partitions to restore |
| `partition_mapping` | map | - | Partition remapping |
| `topic_mapping` | map | - | Topic remapping |
| `consumer_group_strategy` | string | `skip` | Offset handling strategy |
| `dry_run` | bool | `false` | Validate without executing |
| `include_original_offset_header` | bool | `true` | Add original offset header |
| `rate_limit_records_per_sec` | int | - | Rate limit (records/sec) |
| `rate_limit_bytes_per_sec` | int | - | Rate limit (bytes/sec) |
| `max_concurrent_partitions` | int | `4` | Parallel partitions |
| `produce_batch_size` | int | `1000` | Batch size |
| `reset_consumer_offsets` | bool | `false` | Reset consumer offsets |
| `consumer_groups` | list | - | Consumer groups to reset |

### Consumer Group Strategies

| Strategy | Description |
|----------|-------------|
| `skip` | Don't modify consumer offsets |
| `header-based` | Use offset mapping from backup headers |
| `timestamp-based` | Reset to timestamp-based offsets |
| `cluster-scan` | Scan target cluster for offset mapping |
| `manual` | Generate script for manual reset |

---

## Complete Examples

### Basic Backup

```yaml
mode: backup
backup_id: "daily-backup"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - orders
      - payments

storage:
  backend: filesystem
  path: "/data/backups"

backup:
  compression: zstd
```

### Production S3 Backup

```yaml
mode: backup
backup_id: "prod-backup-${BACKUP_DATE}"

source:
  bootstrap_servers:
    - broker-1.prod.kafka:9092
    - broker-2.prod.kafka:9092
    - broker-3.prod.kafka:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: backup-service
    sasl_password: ${KAFKA_PASSWORD}
    ssl_ca_location: /etc/kafka/ca.crt
  topics:
    include:
      - "*"
    exclude:
      - "__consumer_offsets"
      - "_schemas"
      - "*-internal"

storage:
  backend: s3
  bucket: company-kafka-backups
  region: us-west-2
  prefix: production/${CLUSTER_NAME}

backup:
  compression: zstd
  compression_level: 5
  checkpoint_interval_secs: 60
  include_offset_headers: true
  source_cluster_id: "prod-us-west-2"
```

### Point-in-Time Restore

```yaml
mode: restore
backup_id: "prod-backup-20241201"

target:
  bootstrap_servers:
    - dr-broker-1:9092
    - dr-broker-2:9092

storage:
  backend: s3
  bucket: company-kafka-backups
  region: us-west-2
  prefix: production/prod-cluster

restore:
  # Restore only data from Dec 1, 2024 10:00 to 14:00 UTC
  time_window_start: 1701424800000
  time_window_end: 1701439200000

  topic_mapping:
    orders: orders_restored

  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-processor
    - analytics-service
```

### Disaster Recovery Restore

```yaml
mode: restore
backup_id: "prod-backup-latest"

target:
  bootstrap_servers:
    - dr-broker-1.dr.kafka:9092
    - dr-broker-2.dr.kafka:9092
    - dr-broker-3.dr.kafka:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: restore-service
    sasl_password: ${DR_KAFKA_PASSWORD}
    ssl_ca_location: /etc/kafka/ca.crt

storage:
  backend: s3
  bucket: company-kafka-backups
  region: us-east-1  # DR region
  prefix: production/prod-cluster

restore:
  dry_run: false
  max_concurrent_partitions: 8
  produce_batch_size: 5000

  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-service
    - payment-service
    - notification-service
    - analytics-pipeline
```

---

## Environment Variable Substitution

Configuration files support environment variable substitution using `${VAR_NAME}` syntax:

```yaml
source:
  security:
    sasl_password: ${KAFKA_PASSWORD}

storage:
  backend: s3
  access_key: ${AWS_ACCESS_KEY_ID}
  secret_key: ${AWS_SECRET_ACCESS_KEY}
```

Set variables before running:

```bash
export KAFKA_PASSWORD="secret123"
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."

kafka-backup backup --config backup.yaml
```
