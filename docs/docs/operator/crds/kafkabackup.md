---
title: KafkaBackup
description: KafkaBackup Custom Resource Definition reference
sidebar_position: 1
---

# KafkaBackup CRD

The `KafkaBackup` custom resource defines a backup configuration for Kafka topics.

## Overview

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: my-backup
  namespace: kafka-backup
spec:
  # Backup configuration
```

## Full Specification

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: production-backup
  namespace: kafka-backup
spec:
  # Schedule (cron format) - omit for one-time backup
  schedule: "0 * * * *"

  # Kafka cluster connection
  kafkaCluster:
    bootstrapServers:
      - kafka-0.kafka.svc:9092
      - kafka-1.kafka.svc:9092
      - kafka-2.kafka.svc:9092

    # Security protocol: PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL
    securityProtocol: SASL_SSL

    # TLS configuration
    tlsSecret:
      name: kafka-tls
      caKey: ca.crt
      certKey: tls.crt
      keyKey: tls.key

    # SASL configuration
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256  # PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
      usernameKey: username
      passwordKey: password

  # Topics to backup
  topics:
    - orders
    - payments
    - "events-*"  # Wildcard patterns

  # Topics to exclude
  excludeTopics:
    - "__consumer_offsets"
    - "_schemas"

  # Storage configuration
  storage:
    storageType: s3  # s3, azure, gcs, pvc

    # S3 configuration
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: production/hourly
      endpoint: ""  # Custom endpoint (MinIO, etc.)
      credentialsSecret:
        name: s3-credentials
        accessKeyKey: accessKey
        secretKeyKey: secretKey

    # Azure Blob configuration (v0.2.1+)
    azure:
      accountName: kafkabackups123456
      container: kafka-backups
      prefix: production/hourly
      # Choose one authentication method:

      # Option 1: Account Key
      credentialsSecret:
        name: azure-credentials
        accountKeyKey: AZURE_STORAGE_KEY

      # Option 2: SAS Token
      # sasTokenSecret:
      #   name: azure-sas-credentials
      #   sasTokenKey: AZURE_SAS_TOKEN

      # Option 3: Service Principal
      # servicePrincipalSecret:
      #   name: azure-sp-credentials
      #   clientIdKey: AZURE_CLIENT_ID
      #   tenantIdKey: AZURE_TENANT_ID
      #   clientSecretKey: AZURE_CLIENT_SECRET

      # Option 4: Workload Identity (AKS)
      # useWorkloadIdentity: true

      # Optional: Custom endpoint for sovereign clouds
      # endpoint: https://kafkabackups.blob.core.usgovcloudapi.net

    # GCS configuration
    gcs:
      bucket: kafka-backups
      prefix: production/hourly
      credentialsSecret:
        name: gcs-credentials
        key: credentials.json

    # PVC configuration
    pvc:
      claimName: backup-storage
      subPath: kafka/production

  # Compression settings
  compression: zstd  # zstd, lz4, none
  compressionLevel: 3  # 1-22 for zstd, 1-12 for lz4

  # Include original offset in message headers
  includeOffsetHeaders: true

  # Source cluster identifier (for offset mapping)
  sourceClusterId: "production-us-west-2"

  # Checkpoint interval
  checkpointIntervalSecs: 30

  # Backup retention
  retention:
    backups: 168  # Number of backups to keep

  # Rate limiting
  rateLimit:
    bytesPerSecond: 104857600  # 100 MB/s
    recordsPerSecond: 100000

  # Circuit breaker
  circuitBreaker:
    enabled: true
    failureThreshold: 5
    resetTimeoutSecs: 60

  # Resource requirements for backup job
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2
      memory: 2Gi

  # Job configuration
  job:
    backoffLimit: 3
    activeDeadlineSeconds: 3600
    ttlSecondsAfterFinished: 86400

  # Pod configuration
  podTemplate:
    annotations:
      prometheus.io/scrape: "true"
    labels:
      app: kafka-backup
    nodeSelector:
      node-type: worker
    tolerations:
      - key: "dedicated"
        operator: "Equal"
        value: "kafka-backup"
        effect: "NoSchedule"
```

## Spec Fields

### kafkaCluster

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bootstrapServers` | []string | Yes | Kafka broker addresses |
| `securityProtocol` | string | No | Security protocol (default: PLAINTEXT) |
| `tlsSecret` | object | No | TLS certificate secret reference |
| `saslSecret` | object | No | SASL credentials secret reference |

### tlsSecret

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name |
| `caKey` | string | No | Key for CA certificate (default: ca.crt) |
| `certKey` | string | No | Key for client certificate (default: tls.crt) |
| `keyKey` | string | No | Key for client key (default: tls.key) |

### saslSecret

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name |
| `mechanism` | string | Yes | SASL mechanism |
| `usernameKey` | string | No | Key for username (default: username) |
| `passwordKey` | string | No | Key for password (default: password) |

### storage

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storageType` | string | Yes | Storage backend (s3, azure, gcs, pvc) |
| `s3` | object | No | S3 configuration |
| `azure` | object | No | Azure Blob configuration |
| `gcs` | object | No | GCS configuration |
| `pvc` | object | No | PVC configuration |

### s3

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bucket` | string | Yes | S3 bucket name |
| `region` | string | Yes | AWS region |
| `prefix` | string | No | Object key prefix |
| `endpoint` | string | No | Custom S3 endpoint |
| `credentialsSecret` | object | No | Credentials secret (uses IRSA if omitted) |

### azure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountName` | string | Yes | Azure storage account name |
| `container` | string | Yes | Blob container name |
| `prefix` | string | No | Blob name prefix |
| `endpoint` | string | No | Custom endpoint (sovereign clouds) |
| `useWorkloadIdentity` | bool | No | Enable AKS Workload Identity (default: false) |
| `credentialsSecret` | object | No | Account key secret reference |
| `sasTokenSecret` | object | No | SAS token secret reference |
| `servicePrincipalSecret` | object | No | Service Principal credentials |

### azure.credentialsSecret

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name |
| `accountKeyKey` | string | No | Key for account key (default: AZURE_STORAGE_KEY) |

### azure.sasTokenSecret

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name |
| `sasTokenKey` | string | No | Key for SAS token (default: AZURE_SAS_TOKEN) |

### azure.servicePrincipalSecret

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Secret name |
| `clientIdKey` | string | No | Key for client ID (default: AZURE_CLIENT_ID) |
| `tenantIdKey` | string | No | Key for tenant ID (default: AZURE_TENANT_ID) |
| `clientSecretKey` | string | No | Key for client secret (default: AZURE_CLIENT_SECRET) |

### retention

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `backups` | int | No | Number of backups to retain |

### rateLimit

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bytesPerSecond` | int | No | Maximum bytes per second |
| `recordsPerSecond` | int | No | Maximum records per second |

## Status

```yaml
status:
  phase: Completed  # Pending, Running, Completed, Failed
  lastBackupId: "production-backup-20241201-120000"
  lastBackupTime: "2024-12-01T12:00:00Z"
  lastBackupSize: 1073741824  # bytes
  lastBackupRecords: 1000000
  nextScheduledTime: "2024-12-01T13:00:00Z"
  backupHistory:
    - backupId: "production-backup-20241201-120000"
      startTime: "2024-12-01T12:00:00Z"
      completionTime: "2024-12-01T12:05:00Z"
      size: 1073741824
      records: 1000000
      outcome: success
  conditions:
    - type: Ready
      status: "True"
      reason: BackupScheduled
      message: "Next backup scheduled for 2024-12-01T13:00:00Z"
      lastTransitionTime: "2024-12-01T12:05:00Z"
```

## Examples

### Simple Backup (Plaintext)

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: simple-backup
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  topics:
    - my-topic
  storage:
    storageType: s3
    s3:
      bucket: my-backups
      region: us-west-2
```

### Scheduled Backup with SASL

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: hourly-backup
spec:
  schedule: "0 * * * *"

  kafkaCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
    tlsSecret:
      name: kafka-tls

  topics:
    - orders
    - payments

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: production/hourly

  compression: zstd
  compressionLevel: 3
  includeOffsetHeaders: true
  sourceClusterId: "production"

  retention:
    backups: 168
```

### Backup to Azure (Account Key)

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: azure-backup
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - "*"

  storage:
    storageType: azure
    azure:
      accountName: kafkabackups123456
      container: kafka-backups
      prefix: production
      credentialsSecret:
        name: azure-storage
        accountKeyKey: AZURE_STORAGE_KEY
```

### Backup to Azure (Workload Identity - AKS)

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: azure-backup-wi
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: PLAIN

  topics:
    - "*"
  excludeTopics:
    - "__*"

  storage:
    storageType: azure
    azure:
      accountName: kafkabackups123456
      container: kafka-backups
      prefix: production
      useWorkloadIdentity: true  # Uses AKS Workload Identity

  compression: zstd
  compressionLevel: 3
```

### Backup to Azure (Service Principal)

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: azure-backup-sp
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - "orders-*"
    - "payments-*"

  storage:
    storageType: azure
    azure:
      accountName: kafkabackups123456
      container: kafka-backups
      prefix: production
      servicePrincipalSecret:
        name: azure-sp-credentials
```

### Backup to PVC

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: local-backup
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - "*"

  storage:
    storageType: pvc
    pvc:
      claimName: backup-storage
      subPath: kafka
```

## Operations

### Trigger Manual Backup

```bash
# Add annotation to trigger immediate backup
kubectl annotate kafkabackup my-backup kafka.oso.sh/trigger-backup=$(date +%s) --overwrite
```

### Check Backup Status

```bash
kubectl get kafkabackup my-backup -o jsonpath='{.status.phase}'
```

### View Backup History

```bash
kubectl get kafkabackup my-backup -o jsonpath='{.status.backupHistory}' | jq
```

### Delete Old Backups

```bash
# Managed automatically based on retention.backups
# Or manually:
kubectl patch kafkabackup my-backup --type merge -p '{"spec":{"retention":{"backups":10}}}'
```

## Next Steps

- [KafkaRestore](./kafkarestore) - Restore from backups
- [Scheduled Backups Guide](../guides/scheduled-backups) - Scheduling strategies
- [Secrets Guide](../guides/secrets) - Configure credentials
