---
title: Error Codes
description: OSO Kafka Backup error codes, messages, and troubleshooting
sidebar_position: 4
---

# Error Codes

This reference documents all error types in OSO Kafka Backup with causes and solutions.

## Error Categories

| Category | Description |
|----------|-------------|
| **CONFIG** | Configuration file errors |
| **KAFKA** | Kafka connection and protocol errors |
| **STORAGE** | Storage backend errors |
| **VALIDATION** | Data validation errors |
| **IO** | File system I/O errors |
| **OFFSET** | Consumer offset management errors |

---

## Configuration Errors

### CONFIG_PARSE_ERROR

**Message:** `Failed to parse configuration file`

**Cause:** Invalid YAML syntax in configuration file.

**Solution:**
1. Validate YAML syntax: `yamllint backup.yaml`
2. Check for missing colons, incorrect indentation
3. Ensure proper quoting of special characters

```bash
# Example: Missing colon
bootstrap_servers  # Wrong
  - broker:9092

bootstrap_servers:  # Correct
  - broker:9092
```

### CONFIG_MISSING_REQUIRED

**Message:** `Missing required configuration: {field}`

**Cause:** Required field not specified in configuration.

**Solution:** Add the missing field to your configuration:

```yaml
# Required fields for backup:
mode: backup           # Required
backup_id: "my-backup" # Required
source:
  bootstrap_servers:   # Required
    - broker:9092
storage:
  backend: filesystem  # Required
  path: "/data"        # Required for filesystem
```

### CONFIG_INVALID_VALUE

**Message:** `Invalid value for {field}: {value}`

**Cause:** Field value is not valid.

**Common cases:**
- Invalid compression algorithm
- Invalid security protocol
- Invalid SASL mechanism
- Compression level out of range

```yaml
# Valid compression values: zstd, lz4, none
compression: gzip  # Invalid

# Valid security protocols
security_protocol: INVALID  # Invalid
security_protocol: SASL_SSL # Valid

# Valid zstd compression levels: 1-22
compression_level: 25  # Invalid (max is 22)
```

### CONFIG_INVALID_TOPICS

**Message:** `At least one topic must be specified`

**Cause:** No topics configured for backup.

**Solution:**
```yaml
source:
  topics:
    include:
      - my-topic       # Add at least one topic
      - "pattern-*"    # Or a pattern
```

---

## Kafka Errors

### KAFKA_CONNECTION_FAILED

**Message:** `Failed to connect to Kafka cluster: {details}`

**Cause:** Cannot establish connection to Kafka brokers.

**Solutions:**

1. **Verify brokers are reachable:**
   ```bash
   nc -zv broker-1 9092
   telnet broker-1 9092
   ```

2. **Check DNS resolution:**
   ```bash
   nslookup broker-1.kafka.svc
   ```

3. **Verify bootstrap servers in config:**
   ```yaml
   source:
     bootstrap_servers:
       - broker-1.kafka.svc:9092  # Use correct hostname/port
   ```

4. **Check network policies/firewalls**

### KAFKA_AUTH_FAILED

**Message:** `Authentication failed: {details}`

**Cause:** SASL authentication failed.

**Solutions:**

1. **Verify credentials:**
   ```yaml
   source:
     security:
       sasl_username: correct-user
       sasl_password: correct-password
   ```

2. **Check SASL mechanism matches broker:**
   ```yaml
   sasl_mechanism: SCRAM-SHA-256  # Must match broker config
   ```

3. **Verify user exists on Kafka cluster:**
   ```bash
   kafka-configs --bootstrap-server broker:9092 \
     --describe --entity-type users --entity-name backup-user
   ```

### KAFKA_SSL_ERROR

**Message:** `SSL/TLS error: {details}`

**Cause:** TLS certificate or configuration error.

**Solutions:**

1. **Verify certificate paths exist:**
   ```bash
   ls -la /etc/kafka/ca.crt
   ls -la /etc/kafka/client.crt
   ls -la /etc/kafka/client.key
   ```

2. **Check certificate validity:**
   ```bash
   openssl x509 -in /etc/kafka/client.crt -text -noout
   openssl verify -CAfile /etc/kafka/ca.crt /etc/kafka/client.crt
   ```

3. **Verify certificate permissions:**
   ```bash
   chmod 600 /etc/kafka/client.key
   ```

### KAFKA_TOPIC_NOT_FOUND

**Message:** `Topic not found: {topic}`

**Cause:** Specified topic doesn't exist on the cluster.

**Solutions:**

1. **List available topics:**
   ```bash
   kafka-topics --bootstrap-server broker:9092 --list
   ```

2. **Check topic name spelling and case**

3. **Verify topic patterns:**
   ```yaml
   topics:
     include:
       - "events-*"  # Check pattern matches actual topics
   ```

### KAFKA_UNAUTHORIZED

**Message:** `Unauthorized: {details}`

**Cause:** User lacks required permissions.

**Required ACLs for backup:**
```
Topic: Read, Describe
Group: Read (for offset tracking)
Cluster: DescribeConfigs (optional)
```

**Solution:**
```bash
kafka-acls --bootstrap-server broker:9092 \
  --add --allow-principal User:backup-user \
  --operation Read --operation Describe \
  --topic '*'
```

---

## Storage Errors

### STORAGE_ACCESS_DENIED

**Message:** `Access denied to storage: {path}`

**Cause:** Insufficient permissions for storage backend.

**Solutions by backend:**

**Filesystem:**
```bash
# Check permissions
ls -la /var/lib/kafka-backup/

# Fix permissions
sudo chown -R kafka-backup:kafka-backup /var/lib/kafka-backup/
chmod -R 755 /var/lib/kafka-backup/
```

**S3:**
```bash
# Test S3 access
aws s3 ls s3://my-bucket/

# Check IAM permissions (need s3:GetObject, s3:PutObject, s3:ListBucket)
```

**Azure:**
```bash
# Test Azure access
az storage blob list --container-name kafka-backups --account-name myaccount
```

### STORAGE_NOT_FOUND

**Message:** `Storage location not found: {path}`

**Cause:** Specified path, bucket, or container doesn't exist.

**Solutions:**

```bash
# Filesystem: Create directory
mkdir -p /var/lib/kafka-backup/data

# S3: Create bucket
aws s3 mb s3://my-kafka-backups

# Azure: Create container
az storage container create --name kafka-backups
```

### STORAGE_QUOTA_EXCEEDED

**Message:** `Storage quota exceeded`

**Cause:** Insufficient storage space.

**Solutions:**

1. **Check available space:**
   ```bash
   df -h /var/lib/kafka-backup/
   ```

2. **Clean up old backups:**
   ```bash
   kafka-backup list --path /data
   # Remove old backups manually or implement retention
   ```

3. **Increase storage allocation**

### STORAGE_CREDENTIALS_INVALID

**Message:** `Invalid storage credentials`

**Cause:** Cloud storage credentials are incorrect or expired.

**Solutions:**

**S3:**
```bash
# Test credentials
aws sts get-caller-identity

# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

**Azure:**
```bash
# Test credentials
az storage account show --name myaccount
```

**GCS:**
```bash
# Test credentials
gcloud auth application-default print-access-token
```

---

## Validation Errors

### VALIDATION_BACKUP_NOT_FOUND

**Message:** `Backup not found: {backup_id}`

**Cause:** Specified backup ID doesn't exist in storage.

**Solutions:**

1. **List available backups:**
   ```bash
   kafka-backup list --path /data
   ```

2. **Check backup ID spelling**

3. **Verify storage path is correct**

### VALIDATION_MANIFEST_CORRUPT

**Message:** `Backup manifest is corrupted`

**Cause:** The manifest.json file is missing or invalid.

**Solutions:**

1. **Check if manifest exists:**
   ```bash
   cat /data/backup-001/manifest.json | jq .
   ```

2. **Restore from a different backup**

3. **Contact support if critical data**

### VALIDATION_SEGMENT_CORRUPT

**Message:** `Segment validation failed: {segment}`

**Cause:** Segment file is corrupted (checksum mismatch).

**Solutions:**

1. **Run deep validation:**
   ```bash
   kafka-backup validate --path /data --backup-id backup-001 --deep
   ```

2. **Check for partial writes (backup may have been interrupted)**

3. **Restore from a different backup point**

### VALIDATION_PITR_INVALID

**Message:** `Invalid PITR time window: start must be before end`

**Cause:** time_window_start is greater than time_window_end.

**Solution:**
```yaml
restore:
  time_window_start: 1701417600000  # Earlier timestamp
  time_window_end: 1701504000000    # Later timestamp
```

---

## Offset Errors

### OFFSET_RESET_FAILED

**Message:** `Failed to reset consumer offsets: {details}`

**Cause:** Error resetting consumer group offsets.

**Solutions:**

1. **Stop consumers first:**
   ```bash
   # Consumer group must be inactive
   kafka-consumer-groups --bootstrap-server broker:9092 \
     --group my-group --describe
   ```

2. **Check group permissions:**
   ```bash
   kafka-acls --bootstrap-server broker:9092 \
     --add --allow-principal User:backup-user \
     --operation Read --operation Describe \
     --group my-group
   ```

### OFFSET_SNAPSHOT_NOT_FOUND

**Message:** `Offset snapshot not found: {snapshot_id}`

**Cause:** Referenced snapshot doesn't exist.

**Solution:**
```bash
# List available snapshots
kafka-backup offset-rollback list --path /data/snapshots
```

### OFFSET_MAPPING_MISSING

**Message:** `Offset mapping not available for backup`

**Cause:** Backup was created without `include_offset_headers: true`.

**Solution:** Re-run backup with offset headers enabled:
```yaml
backup:
  include_offset_headers: true
```

---

## I/O Errors

### IO_READ_ERROR

**Message:** `Failed to read file: {path}`

**Cause:** File read operation failed.

**Solutions:**

1. **Check file exists and permissions:**
   ```bash
   ls -la /path/to/file
   ```

2. **Check disk health:**
   ```bash
   dmesg | grep -i error
   smartctl -a /dev/sda
   ```

### IO_WRITE_ERROR

**Message:** `Failed to write file: {path}`

**Cause:** File write operation failed.

**Solutions:**

1. **Check available disk space:**
   ```bash
   df -h
   ```

2. **Check directory permissions:**
   ```bash
   ls -la /path/to/directory/
   ```

3. **Check if filesystem is read-only:**
   ```bash
   mount | grep /data
   ```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Connection error |
| 4 | Authentication error |
| 5 | Storage error |
| 6 | Validation error |

## Getting Help

If you encounter an error not listed here:

1. **Enable verbose logging:**
   ```bash
   kafka-backup -vv backup --config backup.yaml
   ```

2. **Check logs for stack traces**

3. **Search [GitHub Issues](https://github.com/osodevops/kafka-backup/issues)**

4. **Open a new issue** with:
   - Error message
   - Configuration (sanitized)
   - Verbose output
   - Environment details
