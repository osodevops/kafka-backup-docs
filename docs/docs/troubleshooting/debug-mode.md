---
title: Debug Mode
description: Enable verbose logging and debugging for OSO Kafka Backup
sidebar_position: 4
---

# Debug Mode

When troubleshooting issues, debug mode provides detailed logging to help identify problems.

## Enabling Debug Logging

### Via Environment Variable

```bash
# Basic debug logging
export RUST_LOG=debug
kafka-backup backup --config backup.yaml

# Verbose debug logging
export RUST_LOG=trace
kafka-backup backup --config backup.yaml

# Module-specific logging
export RUST_LOG=kafka_backup=debug,rdkafka=info
kafka-backup backup --config backup.yaml
```

### Via CLI Flag

```bash
# Debug mode
kafka-backup backup --config backup.yaml --debug

# Trace mode (most verbose)
kafka-backup backup --config backup.yaml --trace

# Quiet mode (errors only)
kafka-backup backup --config backup.yaml --quiet
```

### Via Configuration

```yaml
logging:
  level: debug  # error, warn, info, debug, trace
  format: json  # text or json
  output: stderr  # or file path

  # Module-specific levels
  modules:
    kafka_backup: debug
    rdkafka: warn
    aws_sdk: info
```

## Log Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| `error` | Critical failures only | Production (minimal logging) |
| `warn` | Warnings and errors | Production (recommended) |
| `info` | Progress and status | Normal operation |
| `debug` | Detailed operation info | Troubleshooting |
| `trace` | All internal details | Deep debugging |

## Understanding Debug Output

### Backup Debug Output

```
2024-12-01T10:00:00.123Z DEBUG kafka_backup::backup Starting backup
2024-12-01T10:00:00.124Z DEBUG kafka_backup::kafka Connecting to bootstrap servers: ["kafka:9092"]
2024-12-01T10:00:00.200Z DEBUG rdkafka::client Broker kafka:9092 connected (version 3.5.0)
2024-12-01T10:00:00.201Z DEBUG kafka_backup::kafka Fetching topic metadata
2024-12-01T10:00:00.250Z DEBUG kafka_backup::kafka Topics found: ["orders", "payments"]
2024-12-01T10:00:00.251Z DEBUG kafka_backup::backup Starting partition consumers
2024-12-01T10:00:00.252Z DEBUG kafka_backup::consumer Partition 0: seeking to offset 0
2024-12-01T10:00:00.253Z DEBUG kafka_backup::consumer Partition 1: seeking to offset 0
2024-12-01T10:00:01.000Z DEBUG kafka_backup::consumer Partition 0: received batch of 1000 records
2024-12-01T10:00:01.001Z DEBUG kafka_backup::compress Compressing batch (10 MB → 2 MB)
2024-12-01T10:00:01.050Z DEBUG kafka_backup::storage Writing segment: s3://bucket/backups/segment-0000.dat
2024-12-01T10:00:01.200Z DEBUG kafka_backup::storage Segment written successfully (2 MB)
```

### Key Information to Look For

1. **Connection details**
   ```
   DEBUG kafka_backup::kafka Connecting to bootstrap servers
   DEBUG rdkafka::client Broker connected
   ```

2. **Topic/partition discovery**
   ```
   DEBUG kafka_backup::kafka Topics found: [...]
   DEBUG kafka_backup::backup Partitions to backup: [...]
   ```

3. **Progress information**
   ```
   DEBUG kafka_backup::consumer Partition X: received batch
   DEBUG kafka_backup::storage Writing segment
   ```

4. **Errors and retries**
   ```
   WARN kafka_backup::storage Write failed, retrying (attempt 2/3)
   ERROR kafka_backup::storage Write failed: Access denied
   ```

## Kafka Client Debugging

### librdkafka Debugging

```bash
# Enable rdkafka debug
export RUST_LOG=rdkafka=debug
kafka-backup backup --config backup.yaml

# Or via config
source:
  kafka_config:
    debug: "all"  # broker,topic,msg,protocol,cgrp,security,fetch,feature,interceptor,all
```

### Specific Debug Categories

```yaml
source:
  kafka_config:
    debug: "broker,security,fetch"
```

| Category | What it Shows |
|----------|---------------|
| `broker` | Broker connections |
| `security` | SASL/SSL handshakes |
| `fetch` | Fetch requests/responses |
| `msg` | Message processing |
| `protocol` | Wire protocol details |
| `cgrp` | Consumer group operations |

### SSL/TLS Debugging

```bash
# Enable OpenSSL debugging
export RUST_LOG=rdkafka::client=debug

# Check SSL handshake
kafka-backup backup --config backup.yaml --debug 2>&1 | grep -i ssl
```

## Storage Debugging

### S3 Debugging

```bash
# Enable AWS SDK debug logging
export RUST_LOG=aws_sdk_s3=debug,aws_config=debug
kafka-backup backup --config backup.yaml
```

### Azure Debugging

```bash
export RUST_LOG=azure_storage=debug
kafka-backup backup --config backup.yaml
```

### GCS Debugging

```bash
export RUST_LOG=google_cloud_storage=debug
kafka-backup backup --config backup.yaml
```

## Network Debugging

### TCP Connection Issues

```bash
# Test basic connectivity
nc -zv kafka 9092
nc -zv kafka 9093  # SSL port

# DNS resolution
nslookup kafka

# TCP dump (requires root)
tcpdump -i any port 9092 -w kafka-traffic.pcap
```

### SSL Certificate Debugging

```bash
# Check server certificate
openssl s_client -connect kafka:9093 -CAfile ca.crt

# Verify certificate chain
openssl verify -CAfile ca.crt server.crt

# Check certificate expiry
openssl x509 -in server.crt -noout -dates
```

## Dry Run Mode

Test configuration without making changes:

```bash
# Backup dry run
kafka-backup backup --config backup.yaml --dry-run

# Output:
# DRY RUN: Would backup the following:
#   Topics: orders, payments
#   Partitions: 6
#   Estimated records: ~500,000
#   Storage path: s3://bucket/backups/my-backup
```

```bash
# Restore dry run
kafka-backup restore --config restore.yaml --dry-run

# Output:
# DRY RUN: Would restore the following:
#   Backup: my-backup
#   Topics: orders → orders, payments → payments
#   PITR: 2024-12-01T00:00:00Z to 2024-12-01T12:00:00Z
#   Estimated records: ~250,000
```

## Validation Commands

### Validate Configuration

```bash
# Check config syntax and connectivity
kafka-backup validate-config --config backup.yaml

# Output:
# Configuration: Valid
# Kafka connection: OK
# Storage connection: OK
# Topics found: 5
# Estimated partitions: 15
```

### Validate Backup

```bash
# Quick validation
kafka-backup validate \
  --path s3://bucket/backups \
  --backup-id my-backup

# Deep validation (slower, checks all data)
kafka-backup validate \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --deep

# Verbose validation
kafka-backup validate \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --deep \
  --verbose
```

### Validate Restore Configuration

```bash
kafka-backup validate-restore --config restore.yaml

# Output:
# Backup: Found
# Target cluster: Reachable
# Topics: All exist / Will be created
# PITR window: Valid (250,000 records match)
# Offset headers: Present
```

## JSON Output

For scripting and analysis:

```bash
# JSON output
kafka-backup backup --config backup.yaml --output json > backup-log.json

# JQ filtering
cat backup-log.json | jq 'select(.level == "ERROR")'
cat backup-log.json | jq 'select(.target == "kafka_backup::storage")'
```

## Log Files

### Configure File Logging

```yaml
logging:
  level: debug
  output: /var/log/kafka-backup/backup.log
  rotation:
    max_size_mb: 100
    max_files: 5
```

### Kubernetes Logging

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: debug-backup
spec:
  logging:
    level: debug

  # Or via environment
  env:
    - name: RUST_LOG
      value: "kafka_backup=debug,rdkafka=info"
```

View logs:

```bash
kubectl logs -n kafka-backup deployment/kafka-backup-operator -f

# Filter for errors
kubectl logs -n kafka-backup deployment/kafka-backup-operator | grep ERROR
```

## Common Debug Scenarios

### Connection Timeouts

```bash
export RUST_LOG=rdkafka::client=debug,kafka_backup::kafka=debug
kafka-backup backup --config backup.yaml 2>&1 | grep -E "(timeout|connect|broker)"
```

### Authentication Failures

```bash
export RUST_LOG=rdkafka::client=debug
kafka-backup backup --config backup.yaml 2>&1 | grep -iE "(auth|sasl|ssl|security)"
```

### Slow Performance

```bash
export RUST_LOG=kafka_backup=debug
kafka-backup backup --config backup.yaml 2>&1 | grep -E "(batch|compress|write|duration)"
```

### Storage Issues

```bash
export RUST_LOG=kafka_backup::storage=debug,aws_sdk_s3=debug
kafka-backup backup --config backup.yaml 2>&1 | grep -iE "(s3|storage|write|upload)"
```

## Getting Help

When reporting issues, include:

1. **Debug logs** with sensitive data redacted
2. **Configuration file** (without credentials)
3. **Version information**: `kafka-backup --version`
4. **Environment details**: OS, Kafka version, storage backend
5. **Steps to reproduce**

## Next Steps

- [Common Errors](./common-errors) - Error reference
- [Performance Issues](./performance-issues) - Performance debugging
- [Support](./support) - Get help
