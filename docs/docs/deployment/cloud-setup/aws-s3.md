---
title: AWS S3 Setup
description: Configure AWS S3 as storage backend for OSO Kafka Backup
sidebar_position: 1
---

# AWS S3 Setup

Configure Amazon S3 or S3-compatible storage for Kafka backups.

## Prerequisites

- AWS account with S3 access
- AWS CLI configured (optional, for testing)
- IAM permissions to create buckets and policies

## Create S3 Bucket

### Using AWS CLI

```bash
# Create bucket
aws s3 mb s3://my-kafka-backups --region us-west-2

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket my-kafka-backups \
  --versioning-configuration Status=Enabled

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket my-kafka-backups \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'
```

### Using Terraform

```hcl title="s3.tf"
resource "aws_s3_bucket" "kafka_backups" {
  bucket = "my-kafka-backups"
}

resource "aws_s3_bucket_versioning" "kafka_backups" {
  bucket = aws_s3_bucket.kafka_backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kafka_backups" {
  bucket = aws_s3_bucket.kafka_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "kafka_backups" {
  bucket = aws_s3_bucket.kafka_backups.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}
```

## IAM Policy

### Minimum Required Permissions

```json title="kafka-backup-policy.json"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::my-kafka-backups"
    },
    {
      "Sid": "ObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::my-kafka-backups/*"
    }
  ]
}
```

### Create IAM User

```bash
# Create user
aws iam create-user --user-name kafka-backup

# Attach policy
aws iam put-user-policy \
  --user-name kafka-backup \
  --policy-name kafka-backup-s3 \
  --policy-document file://kafka-backup-policy.json

# Create access keys
aws iam create-access-key --user-name kafka-backup
```

### IAM Role (for EC2/EKS)

```json title="trust-policy.json"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

```bash
# Create role
aws iam create-role \
  --role-name kafka-backup-role \
  --assume-role-policy-document file://trust-policy.json

# Attach policy
aws iam put-role-policy \
  --role-name kafka-backup-role \
  --policy-name kafka-backup-s3 \
  --policy-document file://kafka-backup-policy.json
```

## IRSA for EKS

For Kubernetes on EKS, use IAM Roles for Service Accounts:

```bash
# Create OIDC provider (if not exists)
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster \
  --approve

# Create service account with IAM role
eksctl create iamserviceaccount \
  --name kafka-backup \
  --namespace kafka-backup \
  --cluster my-cluster \
  --attach-policy-arn arn:aws:iam::123456789:policy/kafka-backup-s3 \
  --approve
```

## Configuration

### With Access Keys

```yaml title="backup.yaml"
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  prefix: production/daily
  access_key: ${AWS_ACCESS_KEY_ID}
  secret_key: ${AWS_SECRET_ACCESS_KEY}
```

### With IAM Role (EC2/EKS)

```yaml title="backup.yaml"
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  prefix: production/daily
  # No credentials needed - uses instance profile or IRSA
```

### With Custom Endpoint (MinIO/Ceph)

```yaml title="backup.yaml"
storage:
  backend: s3
  bucket: kafka-backups
  region: us-east-1
  endpoint: https://minio.example.com:9000
  access_key: ${MINIO_ACCESS_KEY}
  secret_key: ${MINIO_SECRET_KEY}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region |
| `AWS_DEFAULT_REGION` | Alternative region variable |
| `AWS_PROFILE` | AWS CLI profile name |

## Storage Classes

Optimize costs with lifecycle policies:

| Storage Class | Use Case | Cost |
|---------------|----------|------|
| `STANDARD` | Recent backups (< 30 days) | $$$ |
| `STANDARD_IA` | Infrequent access (30-90 days) | $$ |
| `GLACIER_IR` | Archive with fast retrieval | $ |
| `GLACIER` | Long-term archive | $ |
| `DEEP_ARCHIVE` | Compliance archives | $ |

### Lifecycle Policy

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-kafka-backups \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "archive-old-backups",
        "Status": "Enabled",
        "Filter": {
          "Prefix": "production/"
        },
        "Transitions": [
          {
            "Days": 30,
            "StorageClass": "STANDARD_IA"
          },
          {
            "Days": 90,
            "StorageClass": "GLACIER"
          }
        ],
        "Expiration": {
          "Days": 365
        }
      }
    ]
  }'
```

## Cross-Region Replication

For disaster recovery:

```bash
# Enable versioning on destination bucket
aws s3api put-bucket-versioning \
  --bucket my-kafka-backups-dr \
  --versioning-configuration Status=Enabled

# Create replication configuration
aws s3api put-bucket-replication \
  --bucket my-kafka-backups \
  --replication-configuration '{
    "Role": "arn:aws:iam::123456789:role/s3-replication-role",
    "Rules": [
      {
        "Status": "Enabled",
        "Priority": 1,
        "DeleteMarkerReplication": { "Status": "Enabled" },
        "Filter": {},
        "Destination": {
          "Bucket": "arn:aws:s3:::my-kafka-backups-dr"
        }
      }
    ]
  }'
```

## Testing

### Verify Credentials

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test bucket access
aws s3 ls s3://my-kafka-backups/

# Test write access
echo "test" | aws s3 cp - s3://my-kafka-backups/test.txt
aws s3 rm s3://my-kafka-backups/test.txt
```

### Test from Application

```bash
# Run a test backup
kafka-backup backup --config backup.yaml

# List backups
kafka-backup list --path s3://my-kafka-backups/production/daily
```

## Troubleshooting

### Access Denied

```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket my-kafka-backups

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789:user/kafka-backup \
  --action-names s3:PutObject s3:GetObject \
  --resource-arns arn:aws:s3:::my-kafka-backups/*
```

### Slow Uploads

- Use multipart uploads for large segments
- Check network bandwidth
- Consider using S3 Transfer Acceleration

### Cost Optimization

- Enable Intelligent-Tiering for automatic class transitions
- Use lifecycle policies aggressively
- Monitor with S3 Storage Lens

## Security Best Practices

1. **Enable versioning** - Protect against accidental deletes
2. **Enable encryption** - Use SSE-S3 or SSE-KMS
3. **Use IAM roles** - Avoid static credentials
4. **Enable access logging** - Audit bucket access
5. **Block public access** - Ensure bucket is private
6. **Enable MFA delete** - For critical backups

```bash
# Block all public access
aws s3api put-public-access-block \
  --bucket my-kafka-backups \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## Next Steps

- [Backup to S3 Guide](../../guides/backup-to-s3) - Step-by-step backup tutorial
- [Configuration Reference](../../reference/config-yaml) - All storage options
- [Performance Tuning](../../guides/performance-tuning) - Optimize throughput
