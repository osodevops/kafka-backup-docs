---
title: Backup to S3
description: Step-by-step guide to backing up Kafka topics to Amazon S3
sidebar_position: 1
---

# Backup to S3

This guide walks through setting up and running Kafka backups to Amazon S3.

## Prerequisites

- OSO Kafka Backup installed
- Kafka cluster accessible
- AWS S3 bucket created ([AWS S3 Setup](../deployment/cloud-setup/aws-s3))
- AWS credentials configured

## Step 1: Configure AWS Credentials

### Option A: Environment Variables

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-west-2"
```

### Option B: AWS Credentials File

```bash
# ~/.aws/credentials
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...

# ~/.aws/config
[default]
region = us-west-2
```

### Option C: IAM Role (EC2/EKS)

No configuration needed when running on EC2 with instance profile or EKS with IRSA.

## Step 2: Create Backup Configuration

Create `s3-backup.yaml`:

```yaml title="s3-backup.yaml"
mode: backup
backup_id: "production-daily"

source:
  bootstrap_servers:
    - kafka-0.kafka.svc:9092
    - kafka-1.kafka.svc:9092
    - kafka-2.kafka.svc:9092
  topics:
    include:
      - orders
      - payments
      - "events-*"
    exclude:
      - "__consumer_offsets"
      - "_schemas"

storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  prefix: production/daily

backup:
  compression: zstd
  compression_level: 3
  checkpoint_interval_secs: 30
  include_offset_headers: true
  source_cluster_id: "prod-us-west-2"
```

## Step 3: Run the Backup

```bash
kafka-backup backup --config s3-backup.yaml
```

With verbose logging:

```bash
kafka-backup -v backup --config s3-backup.yaml
```

### Expected Output

```
[INFO] Starting backup: production-daily
[INFO] Connecting to Kafka cluster...
[INFO] Connected to cluster: prod-us-west-2
[INFO] Storage: s3://my-kafka-backups/production/daily
[INFO] Topics to backup:
  - orders (6 partitions)
  - payments (3 partitions)
  - events-clickstream (12 partitions)

[INFO] Backing up topic: orders
  Partition 0: 150,234 records
  Partition 1: 148,892 records
  ...

[INFO] Backup completed successfully
[INFO] Summary:
  Topics: 3
  Records: 1,234,567
  Compressed Size: 128 MB
  Duration: 4m 23s
  S3 Objects: 45
```

## Step 4: Verify the Backup

### List Backups

```bash
kafka-backup list --path s3://my-kafka-backups/production/daily
```

### Describe Backup

```bash
kafka-backup describe \
  --path s3://my-kafka-backups/production/daily \
  --backup-id production-daily
```

### Validate Integrity

```bash
# Quick validation
kafka-backup validate \
  --path s3://my-kafka-backups/production/daily \
  --backup-id production-daily

# Deep validation
kafka-backup validate \
  --path s3://my-kafka-backups/production/daily \
  --backup-id production-daily \
  --deep
```

## Step 5: Verify in S3

```bash
# List backup objects
aws s3 ls s3://my-kafka-backups/production/daily/production-daily/ --recursive

# Check manifest
aws s3 cp s3://my-kafka-backups/production/daily/production-daily/manifest.json - | jq .
```

## Incremental Backups

For subsequent backups, use a different backup_id or timestamp:

```yaml
backup_id: "production-daily-$(date +%Y%m%d)"
```

Or use continuous backup mode:

```yaml
backup:
  continuous: true  # Stream changes continuously
  start_offset: latest  # Start from current position
```

## Scheduled Backups

### Cron

```bash
# Daily at 2 AM
0 2 * * * /usr/local/bin/kafka-backup backup --config /etc/kafka-backup/s3-backup.yaml >> /var/log/kafka-backup/backup.log 2>&1
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kafka-backup-s3
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: kafka-backup
              image: ghcr.io/osodevops/kafka-backup:latest
              args: ["backup", "--config", "/config/s3-backup.yaml"]
              env:
                - name: AWS_REGION
                  value: us-west-2
              # Use IRSA or mount credentials
```

## S3 Best Practices

### Use Lifecycle Policies

Automatically transition old backups to cheaper storage:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-kafka-backups \
  --lifecycle-configuration file://lifecycle.json
```

### Enable Versioning

Protect against accidental overwrites:

```bash
aws s3api put-bucket-versioning \
  --bucket my-kafka-backups \
  --versioning-configuration Status=Enabled
```

### Use Server-Side Encryption

```bash
aws s3api put-bucket-encryption \
  --bucket my-kafka-backups \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'
```

## Troubleshooting

### Access Denied

```bash
# Test credentials
aws sts get-caller-identity

# Test bucket access
aws s3 ls s3://my-kafka-backups/
```

### Slow Uploads

- Check network bandwidth to S3
- Use a bucket in the same region as your Kafka cluster
- Consider using S3 Transfer Acceleration
- Increase segment size for fewer uploads

### Connection Timeout

- Check security groups and network ACLs
- Verify VPC endpoint configuration (if using)
- Check for proxy settings

## Next Steps

- [Point-in-Time Recovery](./restore-pitr) - Restore from S3 backup
- [Performance Tuning](./performance-tuning) - Optimize backup speed
- [Kubernetes Operator](../operator) - Automate S3 backups
