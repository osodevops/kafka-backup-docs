---
title: Common Errors
description: Troubleshooting common OSO Kafka Backup errors
sidebar_position: 1
---

# Common Errors

This guide covers the most frequently encountered errors and their solutions.

## Connection Errors

### Failed to Connect to Kafka

```
Error: Failed to connect to Kafka broker
Cause: Connection refused (os error 111)
Broker: kafka:9092
```

**Causes:**
- Broker is not running
- Wrong hostname/port
- Network/firewall issue

**Solutions:**

```bash
# Test connectivity
nc -zv kafka 9092

# Check if Kafka is running
kafka-broker-api-versions --bootstrap-server kafka:9092

# Verify DNS resolution
nslookup kafka
```

```yaml
# Fix: Correct broker addresses
source:
  bootstrap_servers:
    - kafka-0.kafka.svc.cluster.local:9092
    - kafka-1.kafka.svc.cluster.local:9092
```

### SSL Handshake Failed

```
Error: SSL handshake failed
Cause: certificate verify failed
```

**Causes:**
- Missing CA certificate
- Expired certificate
- Hostname mismatch

**Solutions:**

```bash
# Verify certificate
openssl s_client -connect kafka:9093 -CAfile ca.crt

# Check certificate expiry
openssl x509 -in ca.crt -noout -dates

# Check hostname in certificate
openssl x509 -in server.crt -noout -text | grep -A1 "Subject Alternative Name"
```

```yaml
# Fix: Provide correct CA certificate
source:
  security:
    security_protocol: SSL
    ssl_ca_location: /certs/ca.crt
```

### SASL Authentication Failed

```
Error: SASL authentication failed
Cause: Authentication failed during SASL handshake
```

**Causes:**
- Wrong username/password
- User doesn't exist
- Wrong SASL mechanism

**Solutions:**

```bash
# Test authentication with kafka-console-consumer
kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --consumer.config client.properties \
  --topic test --max-messages 1
```

```yaml
# Fix: Verify credentials
source:
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256  # Ensure correct mechanism
    sasl_username: backup-user
    sasl_password: ${KAFKA_PASSWORD}  # Check environment variable
```

## Storage Errors

### Access Denied to S3

```
Error: Access denied to S3 bucket
Bucket: my-kafka-backups
Operation: PutObject
```

**Causes:**
- Missing IAM permissions
- Wrong credentials
- Bucket policy restriction

**Solutions:**

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test bucket access
aws s3 ls s3://my-kafka-backups/

# Check bucket policy
aws s3api get-bucket-policy --bucket my-kafka-backups
```

```json
// Fix: Add IAM policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-kafka-backups",
        "arn:aws:s3:::my-kafka-backups/*"
      ]
    }
  ]
}
```

### Bucket Not Found

```
Error: Bucket not found
Bucket: my-kafka-backups
Region: us-west-2
```

**Solutions:**

```bash
# Verify bucket exists
aws s3api head-bucket --bucket my-kafka-backups

# Check region
aws s3api get-bucket-location --bucket my-kafka-backups
```

```yaml
# Fix: Correct bucket and region
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-east-1  # Correct region
```

### Azure Storage Error

```
Error: Azure storage operation failed
Container: kafka-backups
Status: 403 Forbidden
```

**Solutions:**

```bash
# Test Azure credentials
az storage container list --account-name mystorageaccount

# Check connection string
az storage container show --name kafka-backups --account-name mystorageaccount
```

```yaml
# Fix: Verify connection string
storage:
  backend: azure
  container: kafka-backups
  connection_string: ${AZURE_STORAGE_CONNECTION_STRING}
```

## Backup Errors

### Topic Not Found

```
Error: Topic not found
Topic: orders
Cluster: kafka:9092
```

**Causes:**
- Topic doesn't exist
- ACL restriction
- Typo in topic name

**Solutions:**

```bash
# List topics
kafka-topics --bootstrap-server kafka:9092 --list

# Check if topic exists
kafka-topics --bootstrap-server kafka:9092 --describe --topic orders
```

```yaml
# Fix: Use correct topic pattern
source:
  topics:
    include:
      - orders  # Exact name
      - "orders-*"  # Or pattern
```

### Not Authorized to Access Topic

```
Error: Not authorized to access topic
Topic: production-orders
User: backup-user
```

**Solutions:**

```bash
# Check ACLs
kafka-acls --bootstrap-server kafka:9092 \
  --list --topic production-orders

# Add read permission
kafka-acls --bootstrap-server kafka:9092 \
  --add --allow-principal User:backup-user \
  --operation Read --operation Describe \
  --topic production-orders
```

### Checkpoint Write Failed

```
Error: Failed to write checkpoint
Path: s3://bucket/backups/checkpoint.json
```

**Causes:**
- Storage permission issue
- Disk full
- Network timeout

**Solutions:**

```bash
# Test write access
echo "test" | aws s3 cp - s3://bucket/backups/test.txt
aws s3 rm s3://bucket/backups/test.txt
```

```yaml
# Fix: Adjust checkpoint settings
backup:
  checkpoint_interval_secs: 60  # Less frequent
  checkpoint_retries: 3
```

## Restore Errors

### Backup Not Found

```
Error: Backup not found
Backup ID: production-backup-20241201
Path: s3://bucket/backups
```

**Solutions:**

```bash
# List available backups
kafka-backup list --path s3://bucket/backups

# Check exact backup ID
kafka-backup list --path s3://bucket/backups --format json | jq '.backups[].backup_id'
```

### Invalid Time Range

```
Error: Invalid time range for PITR
Start: 1701388800000
End: 1701302400000
Reason: Start time is after end time
```

**Solution:**

```yaml
# Fix: Correct time order
restore:
  time_window_start: 1701302400000  # Earlier time
  time_window_end: 1701388800000    # Later time
```

### Topic Already Exists

```
Error: Topic already exists with different configuration
Topic: orders
Existing partitions: 12
Backup partitions: 6
```

**Solutions:**

```yaml
# Option 1: Use topic mapping
restore:
  topic_mapping:
    orders: restored-orders

# Option 2: Delete existing topic first
# (manual step before restore)

# Option 3: Allow partition mismatch
restore:
  allow_partition_mismatch: true
```

### Schema ID Not Found

```
Error: Schema ID not found
Schema ID: 42
Topic: orders
```

**Causes:**
- Schema Registry not backed up
- Schema deleted
- Wrong Schema Registry URL

**Solutions:**

```bash
# Check if schema exists
curl https://schema-registry:8081/schemas/ids/42

# List all schemas
curl https://schema-registry:8081/subjects
```

```yaml
# Fix: Enable Schema Registry sync (Enterprise)
enterprise:
  schema_registry:
    enabled: true
    url: https://schema-registry:8081
```

## Offset Errors

### Consumer Group Not Found

```
Error: Consumer group not found
Group: order-processor
```

**Solutions:**

```bash
# List consumer groups
kafka-consumer-groups --bootstrap-server kafka:9092 --list

# Describe group
kafka-consumer-groups --bootstrap-server kafka:9092 \
  --describe --group order-processor
```

### Offset Out of Range

```
Error: Offset out of range
Topic: orders
Partition: 0
Requested: 50000
Available: 0-45000
```

**Causes:**
- Data retention cleaned old messages
- PITR window mismatch
- Wrong offset mapping

**Solutions:**

```bash
# Check available offsets
kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list kafka:9092 \
  --topic orders
```

```yaml
# Fix: Use timestamp-based reset
offset_reset:
  strategy: timestamp
  timestamp: 1701388800000  # Within available range
```

### Offset Header Not Found

```
Error: Original offset header not found
Topic: orders
Expected header: x-kafka-backup-offset
```

**Causes:**
- Backup didn't include headers
- Headers stripped during processing

**Solutions:**

```yaml
# Fix: Re-backup with headers enabled
backup:
  include_offset_headers: true

# Alternative: Use timestamp-based offset reset
offset_reset:
  strategy: timestamp
```

## Configuration Errors

### Invalid Configuration

```
Error: Invalid configuration
Field: compression_level
Value: 25
Valid range: 1-22
```

**Solution:** Check the [Configuration Reference](../reference/config-yaml) for valid values.

### Missing Required Field

```
Error: Missing required field
Field: source.bootstrap_servers
```

**Solution:**

```yaml
# Fix: Add required field
source:
  bootstrap_servers:
    - kafka:9092
```

### Environment Variable Not Set

```
Error: Environment variable not set
Variable: KAFKA_PASSWORD
Location: source.security.sasl_password
```

**Solution:**

```bash
# Set the environment variable
export KAFKA_PASSWORD="your-password"

# Or use a different approach
source:
  security:
    sasl_password: "direct-value"  # Not recommended
```

## Validation Errors

### Backup Validation Failed

```
Error: Backup validation failed
Backup ID: my-backup
Reason: Checksum mismatch in segment-0005.dat
```

**Causes:**
- Corrupted storage
- Incomplete upload
- Storage system issue

**Solutions:**

```bash
# Run deep validation
kafka-backup validate \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --deep

# Re-run backup
kafka-backup backup --config backup.yaml --force
```

### Restore Validation Failed

```
Error: Restore validation failed
Reason: Target cluster unreachable
```

**Solution:**

```bash
# Validate configuration first
kafka-backup validate-restore --config restore.yaml

# Check target connectivity
kafka-broker-api-versions --bootstrap-server target-kafka:9092
```

## Quick Reference

| Error | Likely Cause | First Step |
|-------|--------------|------------|
| Connection refused | Broker down | Check broker status |
| SSL handshake failed | Certificate issue | Verify certificates |
| SASL auth failed | Wrong credentials | Test with console tools |
| Access denied (S3) | IAM permissions | Check IAM policy |
| Topic not found | ACL or typo | List topics |
| Backup not found | Wrong path/ID | List backups |
| Schema ID not found | SR not backed up | Enable SR sync |

## Next Steps

- [Performance Issues](./performance-issues) - Slow backup/restore
- [Offset Discontinuity](./offset-discontinuity) - Offset problems
- [Debug Mode](./debug-mode) - Enable verbose logging
- [Support](./support) - Get help
