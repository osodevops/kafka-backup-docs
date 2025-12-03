---
title: Compliance & Audit
description: Use OSO Kafka Backup for regulatory compliance and audit requirements
sidebar_position: 2
---

# Compliance & Audit

Meet regulatory requirements and audit needs with OSO Kafka Backup.

## Compliance Challenges

Organizations face various compliance requirements:

| Regulation | Requirement |
|------------|-------------|
| **GDPR** | Data retention, right to erasure, audit trails |
| **SOX** | Financial data integrity, audit trails |
| **HIPAA** | Healthcare data protection, 6-year retention |
| **PCI-DSS** | Payment data security, 1-year retention |
| **SOC 2** | Data availability, integrity, security |
| **MiFID II** | 5-7 year retention for financial communications |

## How Kafka Backup Helps

### Data Retention

Maintain historical data for required periods:

```yaml
# Long-term backup configuration
backup:
  compression: zstd
  compression_level: 9  # Maximum compression for archival

storage:
  backend: s3
  bucket: compliance-archives
  prefix: kafka/2024
```

With S3 lifecycle policies:

```json
{
  "Rules": [
    {
      "ID": "compliance-retention",
      "Status": "Enabled",
      "Transitions": [
        { "Days": 90, "StorageClass": "GLACIER" },
        { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
      ],
      "Expiration": { "Days": 2555 }  // 7 years
    }
  ]
}
```

### Audit Trails

Create immutable audit trails:

```yaml
# Audit-specific backup
mode: backup
backup_id: "audit-${DATE}"

source:
  topics:
    include:
      - audit-events
      - user-actions
      - transactions

backup:
  include_offset_headers: true
  source_cluster_id: "production"
```

### Point-in-Time Evidence

Retrieve data as it existed at any specific moment:

```yaml
restore:
  time_window_start: 1701388800000  # Investigation start
  time_window_end: 1701475200000    # Investigation end
```

## Implementation Patterns

### Pattern 1: Scheduled Compliance Backups

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: compliance-backup
spec:
  schedule: "0 0 * * *"  # Daily at midnight
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  topics:
    - "transactions"
    - "audit-log"
    - "user-events"
  storage:
    storageType: s3
    s3:
      bucket: compliance-backups
      region: us-east-1
      prefix: production/daily
  compression: zstd
  compressionLevel: 9
```

### Pattern 2: Write-Once Storage

Use S3 Object Lock for immutable backups:

```bash
# Enable Object Lock on bucket
aws s3api put-object-lock-configuration \
  --bucket compliance-backups \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 7
      }
    }
  }'
```

### Pattern 3: Cross-Region Archival

Store backups in multiple regions for redundancy:

```yaml
# Primary backup
storage:
  backend: s3
  bucket: compliance-us-east-1
  region: us-east-1

---

# Cross-region replication in S3
# Automatically replicates to compliance-eu-west-1
```

## Audit Scenarios

### Scenario 1: Regulatory Audit

**Request**: "Provide all transactions for customer X during Q3 2024"

**Solution**:

```bash
# 1. Identify relevant backups
kafka-backup list --path s3://compliance-backups/production/daily

# 2. PITR restore for Q3
kafka-backup restore --config audit-restore.yaml
```

```yaml title="audit-restore.yaml"
mode: restore
backup_id: "compliance-q3-2024"

restore:
  time_window_start: 1719792000000  # Jul 1, 2024
  time_window_end: 1727740800000    # Oct 1, 2024

  topic_mapping:
    transactions: audit-investigation-transactions

target:
  bootstrap_servers:
    - audit-kafka:9092
```

```bash
# 3. Query restored data
kafka-console-consumer \
  --bootstrap-server audit-kafka:9092 \
  --topic audit-investigation-transactions \
  --from-beginning \
  | grep "customer-id:X"
```

### Scenario 2: Internal Investigation

**Request**: "What data was visible to user Y on December 1st?"

**Solution**:

```yaml
restore:
  time_window_start: 1701388800000  # Dec 1, 00:00
  time_window_end: 1701475199000    # Dec 1, 23:59

  topics:
    - user-views
    - access-log
```

### Scenario 3: Legal Discovery

**Request**: "Preserve all communications for legal hold"

**Solution**:

```bash
# Create immutable backup
kafka-backup backup --config legal-hold.yaml

# Apply S3 Object Lock
aws s3api put-object-retention \
  --bucket compliance-backups \
  --key legal-hold-case-123/manifest.json \
  --retention '{"Mode": "COMPLIANCE", "RetainUntilDate": "2030-01-01"}'
```

## Data Integrity

### Backup Validation

Regularly validate backup integrity:

```bash
# Weekly deep validation
kafka-backup validate \
  --path s3://compliance-backups/production/daily \
  --backup-id compliance-daily-20241201 \
  --deep
```

### Chain of Custody

Document backup chain:

```json
{
  "backup_id": "compliance-daily-20241201",
  "created_at": "2024-12-01T00:15:32Z",
  "created_by": "kafka-backup-operator",
  "source_cluster": "production-us-east-1",
  "checksum": "sha256:abc123...",
  "storage_location": "s3://compliance-backups/production/daily/",
  "encryption": "AES-256 (SSE-KMS)",
  "retention_policy": "7-years-compliance"
}
```

### Checksums and Verification

```bash
# Get backup manifest with checksums
kafka-backup describe \
  --path s3://compliance-backups/production/daily \
  --backup-id compliance-daily-20241201 \
  --format json | jq '.checksums'
```

## Encryption Requirements

### At Rest

```yaml
storage:
  backend: s3
  bucket: compliance-backups
  # S3 SSE-KMS encryption
  # Configure in bucket settings
```

Enable encryption:

```bash
aws s3api put-bucket-encryption \
  --bucket compliance-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:us-east-1:123456789:key/compliance-key"
      }
    }]
  }'
```

### In Transit

```yaml
source:
  security:
    security_protocol: SASL_SSL
    ssl_ca_location: /certs/ca.crt

storage:
  backend: s3
  # All S3 traffic is HTTPS by default
```

## Access Controls

### IAM Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ComplianceBackupWrite",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectTagging"
      ],
      "Resource": "arn:aws:s3:::compliance-backups/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "ComplianceBackupRead",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectTagging"
      ],
      "Resource": "arn:aws:s3:::compliance-backups/*",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/Department": "Compliance"
        }
      }
    }
  ]
}
```

### Audit Logging

Enable S3 access logging:

```bash
aws s3api put-bucket-logging \
  --bucket compliance-backups \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "compliance-access-logs",
      "TargetPrefix": "s3-access-logs/"
    }
  }'
```

## Retention Management

### Retention Tiers

| Data Type | Hot (S3 Standard) | Warm (S3-IA) | Cold (Glacier) | Archive |
|-----------|-------------------|--------------|----------------|---------|
| Audit logs | 30 days | 90 days | 1 year | 7 years |
| Transactions | 90 days | 1 year | 3 years | 7 years |
| User data | 30 days | - | On deletion | Per GDPR |

### Automated Cleanup

For non-compliance data, implement cleanup:

```yaml
# Lifecycle policy for normal backups
{
  "Rules": [
    {
      "ID": "cleanup-old-backups",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "production/hourly/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

## Reporting

### Backup Reports

Generate compliance reports:

```bash
#!/bin/bash
# Monthly compliance report

echo "=== Kafka Backup Compliance Report ==="
echo "Period: $(date -d 'last month' +%Y-%m)"
echo ""

# List all backups
kafka-backup list --path s3://compliance-backups/production/daily \
  --format json | jq -r '.backups[] | "\(.backup_id) | \(.created_at) | \(.statistics.records) records"'

# Validate recent backups
for backup in $(kafka-backup list --path s3://compliance-backups/production/daily --format json | jq -r '.backups[-7:][].backup_id'); do
  echo "Validating: $backup"
  kafka-backup validate --path s3://compliance-backups/production/daily --backup-id "$backup"
done
```

### Metrics

Track compliance metrics:

```promql
# Backup success rate
sum(rate(kafka_backup_backups_total{outcome="success"}[30d])) /
sum(rate(kafka_backup_backups_total[30d]))

# Data retention coverage
kafka_backup_backup_size_bytes / kafka_backup_total_cluster_size
```

## Best Practices

1. **Automate everything** - Manual processes fail audits
2. **Test restores regularly** - Prove data is recoverable
3. **Document retention policies** - Clear policy documentation
4. **Use immutable storage** - Prevent tampering
5. **Enable comprehensive logging** - Audit all access
6. **Encrypt everywhere** - At rest and in transit
7. **Separate compliance data** - Dedicated buckets/accounts

## Next Steps

- [Security Setup](../guides/security-setup) - Encryption configuration
- [Enterprise Features](../enterprise) - Audit logging, RBAC
- [Kubernetes Operator](../operator) - Automated compliance backups
