---
title: Google Cloud Storage Setup
description: Configure Google Cloud Storage as backend for OSO Kafka Backup
sidebar_position: 3
---

# Google Cloud Storage Setup

Configure Google Cloud Storage (GCS) for Kafka backups.

## Prerequisites

- Google Cloud project
- gcloud CLI installed and configured
- Permissions to create buckets and service accounts

## Create GCS Bucket

### Using gcloud CLI

```bash
# Set variables
PROJECT_ID="my-project"
BUCKET_NAME="my-kafka-backups"
REGION="us-west1"

# Create bucket
gcloud storage buckets create gs://$BUCKET_NAME \
  --project=$PROJECT_ID \
  --location=$REGION \
  --uniform-bucket-level-access

# Enable versioning
gcloud storage buckets update gs://$BUCKET_NAME --versioning

# Set lifecycle policy
cat > lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
EOF

gcloud storage buckets update gs://$BUCKET_NAME --lifecycle-file=lifecycle.json
```

### Using Terraform

```hcl title="gcs.tf"
resource "google_storage_bucket" "kafka_backups" {
  name          = "my-kafka-backups"
  location      = "US-WEST1"
  project       = var.project_id

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}
```

## Authentication

### Service Account

```bash
# Create service account
gcloud iam service-accounts create kafka-backup \
  --display-name="Kafka Backup Service Account" \
  --project=$PROJECT_ID

# Get service account email
SA_EMAIL="kafka-backup@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant bucket access
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"

# Create key file
gcloud iam service-accounts keys create kafka-backup-key.json \
  --iam-account=$SA_EMAIL
```

### Workload Identity (GKE)

```bash
# Enable workload identity on cluster
gcloud container clusters update my-cluster \
  --zone=us-west1-a \
  --workload-pool=${PROJECT_ID}.svc.id.goog

# Create Kubernetes service account
kubectl create serviceaccount kafka-backup -n kafka-backup

# Bind Kubernetes SA to Google SA
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:${PROJECT_ID}.svc.id.goog[kafka-backup/kafka-backup]"

# Annotate Kubernetes SA
kubectl annotate serviceaccount kafka-backup \
  -n kafka-backup \
  iam.gke.io/gcp-service-account=$SA_EMAIL
```

### Application Default Credentials

On GCE VMs or Cloud Run:

```bash
# No explicit configuration needed
# Uses instance metadata service automatically
```

## Configuration

### With Service Account Key

```yaml title="backup.yaml"
storage:
  backend: gcs
  bucket: my-kafka-backups
  prefix: production/daily
  service_account_json: /path/to/kafka-backup-key.json
```

### With Environment Variable

```yaml title="backup.yaml"
storage:
  backend: gcs
  bucket: my-kafka-backups
  prefix: production/daily
  # Uses GOOGLE_APPLICATION_CREDENTIALS environment variable
```

### With Workload Identity (GKE)

```yaml title="backup.yaml"
storage:
  backend: gcs
  bucket: my-kafka-backups
  prefix: production/daily
  # No credentials needed - uses workload identity
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON key |
| `GOOGLE_CLOUD_PROJECT` | Default project ID |
| `CLOUDSDK_CORE_PROJECT` | Alternative project variable |

## IAM Roles

| Role | Description |
|------|-------------|
| `roles/storage.objectViewer` | Read backups |
| `roles/storage.objectCreator` | Create backups |
| `roles/storage.objectAdmin` | Full access (recommended) |
| `roles/storage.admin` | Bucket management |

Minimum required permissions:

```yaml
- storage.objects.create
- storage.objects.delete
- storage.objects.get
- storage.objects.list
```

## Storage Classes

| Class | Use Case | Minimum Storage | Retrieval Cost |
|-------|----------|-----------------|----------------|
| `STANDARD` | Frequent access | None | Free |
| `NEARLINE` | Monthly access | 30 days | $ |
| `COLDLINE` | Quarterly access | 90 days | $$ |
| `ARCHIVE` | Yearly access | 365 days | $$$ |

### Set Default Storage Class

```bash
gcloud storage buckets update gs://$BUCKET_NAME \
  --default-storage-class=NEARLINE
```

## Dual-Region / Multi-Region

For high availability:

```bash
# Create multi-region bucket
gcloud storage buckets create gs://$BUCKET_NAME \
  --location=US \
  --uniform-bucket-level-access

# Create dual-region bucket
gcloud storage buckets create gs://$BUCKET_NAME \
  --location=NAM4 \
  --uniform-bucket-level-access
```

Location options:

| Type | Examples | Use Case |
|------|----------|----------|
| Region | `us-west1` | Single region |
| Dual-region | `NAM4` (Iowa + SC) | HA within continent |
| Multi-region | `US`, `EU`, `ASIA` | Global access |

## Object Lifecycle

```bash
# View current lifecycle
gcloud storage buckets describe gs://$BUCKET_NAME --format="json(lifecycle)"

# Update lifecycle
cat > lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30, "matchesPrefix": ["production/"]}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"numNewerVersions": 3}
      }
    ]
  }
}
EOF

gcloud storage buckets update gs://$BUCKET_NAME --lifecycle-file=lifecycle.json
```

## Security Best Practices

### Enable Uniform Bucket-Level Access

```bash
gcloud storage buckets update gs://$BUCKET_NAME \
  --uniform-bucket-level-access
```

### Enable Object Versioning

```bash
gcloud storage buckets update gs://$BUCKET_NAME --versioning
```

### Configure CMEK (Customer-Managed Encryption Keys)

```bash
# Create key ring
gcloud kms keyrings create kafka-backup-ring \
  --location=us-west1 \
  --project=$PROJECT_ID

# Create key
gcloud kms keys create kafka-backup-key \
  --keyring=kafka-backup-ring \
  --location=us-west1 \
  --purpose=encryption \
  --project=$PROJECT_ID

# Set bucket encryption
gcloud storage buckets update gs://$BUCKET_NAME \
  --default-encryption-key=projects/$PROJECT_ID/locations/us-west1/keyRings/kafka-backup-ring/cryptoKeys/kafka-backup-key
```

### Enable Access Logging

```bash
# Create logging bucket
gcloud storage buckets create gs://${BUCKET_NAME}-logs \
  --location=$REGION

# Enable logging
gcloud storage buckets update gs://$BUCKET_NAME \
  --log-bucket=gs://${BUCKET_NAME}-logs
```

## Testing

### Verify Access

```bash
# Test with gcloud
gcloud storage ls gs://$BUCKET_NAME/

# Test write
echo "test" | gcloud storage cp - gs://$BUCKET_NAME/test.txt
gcloud storage rm gs://$BUCKET_NAME/test.txt

# Test with gsutil
gsutil ls gs://$BUCKET_NAME/
```

### Test Authentication

```bash
# Check active account
gcloud auth list

# Test with service account
gcloud auth activate-service-account --key-file=kafka-backup-key.json
gcloud storage ls gs://$BUCKET_NAME/
```

### Test from Application

```bash
# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/kafka-backup-key.json"

# Run backup
kafka-backup backup --config backup.yaml

# List backups
kafka-backup list --path gs://$BUCKET_NAME/production/daily
```

## Kubernetes Deployment

```yaml title="deployment.yaml"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kafka-backup
  namespace: kafka-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: kafka-backup  # For workload identity
          containers:
            - name: kafka-backup
              image: ghcr.io/osodevops/kafka-backup:latest
              args: ["backup", "--config", "/config/backup.yaml"]
              volumeMounts:
                - name: config
                  mountPath: /config
                # Only needed if not using workload identity:
                # - name: gcp-sa
                #   mountPath: /var/secrets/google
              # env:
              #   - name: GOOGLE_APPLICATION_CREDENTIALS
              #     value: /var/secrets/google/key.json
          volumes:
            - name: config
              configMap:
                name: kafka-backup-config
            # - name: gcp-sa
            #   secret:
            #     secretName: gcp-sa-key
```

## Troubleshooting

### Permission Denied

```bash
# Check IAM policy
gcloud storage buckets get-iam-policy gs://$BUCKET_NAME

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --filter="bindings.members:$SA_EMAIL" \
  --format="table(bindings.role)"
```

### Workload Identity Issues

```bash
# Verify workload identity binding
gcloud iam service-accounts get-iam-policy $SA_EMAIL

# Check pod service account annotation
kubectl get sa kafka-backup -n kafka-backup -o yaml
```

### Slow Transfers

- Use regional buckets close to your Kafka cluster
- Enable parallel composite uploads
- Check network bandwidth

## Next Steps

- [Configuration Reference](../../reference/config-yaml) - All storage options
- [Backup Guide](../../guides/backup-to-s3) - Backup walkthrough
- [Performance Tuning](../../guides/performance-tuning) - Optimize throughput
