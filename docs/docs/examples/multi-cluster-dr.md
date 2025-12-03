---
title: Multi-Cluster DR
description: Disaster recovery across multiple Kafka clusters
sidebar_position: 4
---

# Multi-Cluster Disaster Recovery

This guide demonstrates a comprehensive disaster recovery setup across multiple Kafka clusters in different regions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Multi-Cluster DR Architecture                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   US-WEST-2 (Primary)              US-EAST-1 (DR)                           │
│  ┌─────────────────────┐          ┌─────────────────────┐                   │
│  │   Kafka Cluster     │          │   Kafka Cluster     │                   │
│  │   (Production)      │          │   (Standby)         │                   │
│  │                     │          │                     │                   │
│  │  ┌──────────────┐   │          │  ┌──────────────┐   │                   │
│  │  │ orders       │   │          │  │ orders       │   │                   │
│  │  │ payments     │   │          │  │ payments     │   │                   │
│  │  │ inventory    │   │          │  │ inventory    │   │                   │
│  │  └──────────────┘   │          │  └──────────────┘   │                   │
│  └──────────┬──────────┘          └──────────▲──────────┘                   │
│             │                                │                               │
│             │ Backup                         │ Restore                       │
│             ▼                                │                               │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                    S3 Backup Storage                     │                │
│  │                                                          │                │
│  │  s3://kafka-backups/                                     │                │
│  │  ├── us-west-2/                                          │                │
│  │  │   ├── hourly/                                         │                │
│  │  │   └── daily/                                          │                │
│  │  └── cross-region-replica (us-east-1)                    │                │
│  │                                                          │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                              │
│   EU-WEST-1 (Analytics)            AP-SOUTHEAST-1 (APAC)                    │
│  ┌─────────────────────┐          ┌─────────────────────┐                   │
│  │   Kafka Cluster     │          │   Kafka Cluster     │                   │
│  │   (Read Replica)    │          │   (Regional)        │                   │
│  └─────────────────────┘          └─────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### Primary Cluster Backup (US-WEST-2)

```yaml title="primary-backup.yaml"
mode: backup
backup_id: "primary-${TIMESTAMP}"

source:
  bootstrap_servers:
    - kafka-0.us-west-2.example.com:9092
    - kafka-1.us-west-2.example.com:9092
    - kafka-2.us-west-2.example.com:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: backup-service
    sasl_password: ${KAFKA_PASSWORD}
    ssl_ca_location: /certs/ca.crt

  topics:
    include:
      - orders
      - payments
      - inventory
      - customers
      - "events-*"
    exclude:
      - "__consumer_offsets"
      - "_schemas"

storage:
  backend: s3
  bucket: kafka-backups-primary
  region: us-west-2
  prefix: us-west-2/hourly

backup:
  compression: zstd
  compression_level: 3
  checkpoint_interval_secs: 30
  include_offset_headers: true
  source_cluster_id: "prod-us-west-2"
```

### DR Cluster Restore (US-EAST-1)

```yaml title="dr-restore.yaml"
mode: restore
backup_id: "${BACKUP_ID}"

target:
  bootstrap_servers:
    - kafka-0.us-east-1.example.com:9092
    - kafka-1.us-east-1.example.com:9092
    - kafka-2.us-east-1.example.com:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: restore-service
    sasl_password: ${KAFKA_PASSWORD}
    ssl_ca_location: /certs/ca.crt

storage:
  backend: s3
  bucket: kafka-backups-dr
  region: us-east-1
  prefix: us-west-2/hourly

restore:
  include_original_offset_header: true
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-service
    - payment-processor
    - inventory-manager
    - notification-service
```

## S3 Cross-Region Replication

### Enable Replication

```bash
# Create replication IAM role
aws iam create-role \
  --role-name S3ReplicationRole \
  --assume-role-policy-document file://trust-policy.json

# Attach replication policy
aws iam put-role-policy \
  --role-name S3ReplicationRole \
  --policy-name S3Replication \
  --policy-document file://replication-policy.json

# Enable versioning on both buckets
aws s3api put-bucket-versioning \
  --bucket kafka-backups-primary \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-versioning \
  --bucket kafka-backups-dr \
  --versioning-configuration Status=Enabled

# Configure replication
aws s3api put-bucket-replication \
  --bucket kafka-backups-primary \
  --replication-configuration file://replication-config.json
```

### Replication Configuration

```json title="replication-config.json"
{
  "Role": "arn:aws:iam::123456789:role/S3ReplicationRole",
  "Rules": [
    {
      "ID": "KafkaBackupReplication",
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {
        "Prefix": "us-west-2/"
      },
      "Destination": {
        "Bucket": "arn:aws:s3:::kafka-backups-dr",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {
            "Minutes": 15
          }
        },
        "Metrics": {
          "Status": "Enabled",
          "EventThreshold": {
            "Minutes": 15
          }
        }
      },
      "DeleteMarkerReplication": {
        "Status": "Disabled"
      }
    }
  ]
}
```

## Kubernetes Operator Setup

### Primary Cluster (US-WEST-2)

```yaml title="primary-operator.yaml"
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: primary-hourly-backup
  namespace: kafka-backup
spec:
  schedule: "0 * * * *"  # Hourly

  kafkaCluster:
    bootstrapServers:
      - kafka-0.us-west-2.example.com:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
    tlsSecret:
      name: kafka-tls

  topics:
    - orders
    - payments
    - inventory
    - customers
    - "events-*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups-primary
      region: us-west-2
      prefix: us-west-2/hourly

  compression: zstd
  compressionLevel: 3
  includeOffsetHeaders: true
  sourceClusterId: "prod-us-west-2"

  retention:
    backups: 168  # 7 days of hourly backups

---
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: primary-daily-backup
  namespace: kafka-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM

  kafkaCluster:
    bootstrapServers:
      - kafka-0.us-west-2.example.com:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  topics:
    - "*"
  excludeTopics:
    - "__*"
    - "_*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups-primary
      region: us-west-2
      prefix: us-west-2/daily

  compression: zstd
  compressionLevel: 6  # Higher compression for archival
  includeOffsetHeaders: true
  sourceClusterId: "prod-us-west-2"

  retention:
    backups: 90  # 90 days of daily backups
```

### DR Cluster (US-EAST-1)

```yaml title="dr-restore-operator.yaml"
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: dr-restore
  namespace: kafka-backup
spec:
  # Triggered manually or by automation
  backupId: "primary-20241201-120000"

  targetCluster:
    bootstrapServers:
      - kafka-0.us-east-1.example.com:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups-dr
      region: us-east-1
      prefix: us-west-2/hourly

  offsetReset:
    strategy: headerBased
    sourceCluster: "prod-us-west-2"
    consumerGroups:
      - order-service
      - payment-processor
      - inventory-manager
```

## DR Automation Scripts

### Failover Script

```bash
#!/bin/bash
# failover.sh - Execute DR failover

set -e

BACKUP_PATH="s3://kafka-backups-dr/us-west-2/hourly"
DR_CLUSTER="kafka-0.us-east-1.example.com:9092"
NAMESPACE="kafka-backup"

echo "=========================================="
echo "  KAFKA DR FAILOVER"
echo "  $(date)"
echo "=========================================="

# Step 1: Find latest backup
echo "[1/6] Finding latest backup..."
LATEST_BACKUP=$(kafka-backup list --path "$BACKUP_PATH" --format json | jq -r '.backups[-1].backup_id')
echo "      Latest backup: $LATEST_BACKUP"

# Step 2: Validate backup
echo "[2/6] Validating backup..."
kafka-backup validate --path "$BACKUP_PATH" --backup-id "$LATEST_BACKUP" --deep

# Step 3: Scale down applications (optional, if running in DR)
echo "[3/6] Scaling down DR applications..."
kubectl scale deployment -n production -l tier=kafka-consumer --replicas=0

# Step 4: Execute restore
echo "[4/6] Restoring data to DR cluster..."
cat > /tmp/dr-restore.yaml << EOF
mode: restore
backup_id: "$LATEST_BACKUP"

target:
  bootstrap_servers:
    - $DR_CLUSTER
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: restore-service
    sasl_password: \${KAFKA_PASSWORD}

storage:
  backend: s3
  bucket: kafka-backups-dr
  region: us-east-1
  prefix: us-west-2/hourly

restore:
  include_original_offset_header: true
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-service
    - payment-processor
    - inventory-manager
    - notification-service
EOF

kafka-backup three-phase-restore --config /tmp/dr-restore.yaml

# Step 5: Verify restore
echo "[5/6] Verifying restore..."
kafka-topics --bootstrap-server "$DR_CLUSTER" --list
kafka-consumer-groups --bootstrap-server "$DR_CLUSTER" --list

# Step 6: Scale up applications
echo "[6/6] Scaling up DR applications..."
kubectl scale deployment -n production -l tier=kafka-consumer --replicas=3

echo "=========================================="
echo "  FAILOVER COMPLETE"
echo "  DR Cluster: $DR_CLUSTER"
echo "  Backup Used: $LATEST_BACKUP"
echo "=========================================="
```

### Failback Script

```bash
#!/bin/bash
# failback.sh - Return to primary after DR event

set -e

PRIMARY_CLUSTER="kafka-0.us-west-2.example.com:9092"
DR_CLUSTER="kafka-0.us-east-1.example.com:9092"

echo "=========================================="
echo "  KAFKA DR FAILBACK"
echo "  $(date)"
echo "=========================================="

# Step 1: Backup DR cluster (capture changes made during DR)
echo "[1/5] Backing up DR cluster changes..."
kafka-backup backup --config dr-backup.yaml

# Step 2: Verify primary is healthy
echo "[2/5] Verifying primary cluster health..."
kafka-broker-api-versions --bootstrap-server "$PRIMARY_CLUSTER"

# Step 3: Sync DR changes to primary
echo "[3/5] Syncing DR changes to primary..."
# This restores only the delta (changes made during DR event)
kafka-backup restore --config failback-restore.yaml

# Step 4: Reset consumer offsets on primary
echo "[4/5] Resetting consumer offsets..."
kafka-backup offset-reset execute \
  --bootstrap-servers "$PRIMARY_CLUSTER" \
  --strategy timestamp \
  --timestamp "$(date +%s000)" \
  --groups order-service,payment-processor,inventory-manager

# Step 5: Redirect traffic back to primary
echo "[5/5] Redirecting traffic to primary..."
# Update DNS, load balancer, or service mesh configuration
kubectl patch configmap kafka-config -n production \
  --patch '{"data":{"bootstrap.servers":"kafka-0.us-west-2.example.com:9092"}}'

# Restart applications to pick up new config
kubectl rollout restart deployment -n production -l tier=kafka-consumer

echo "=========================================="
echo "  FAILBACK COMPLETE"
echo "  Primary Cluster: $PRIMARY_CLUSTER"
echo "=========================================="
```

## Monitoring and Alerting

### Prometheus Rules

```yaml title="prometheus-rules.yaml"
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kafka-backup-alerts
  namespace: monitoring
spec:
  groups:
    - name: kafka-backup
      rules:
        # Backup failure alert
        - alert: KafkaBackupFailed
          expr: kafka_backup_backups_total{outcome="failure"} > 0
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Kafka backup failed"
            description: "Backup {{ $labels.backup_id }} failed"

        # Backup lag alert
        - alert: KafkaBackupLag
          expr: time() - kafka_backup_last_successful_backup_timestamp > 7200
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Kafka backup lag"
            description: "No successful backup in 2 hours"

        # S3 replication lag
        - alert: S3ReplicationLag
          expr: aws_s3_replication_latency_seconds > 1800
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "S3 cross-region replication lag"
            description: "Replication lag exceeds 30 minutes"

        # DR readiness
        - alert: DRNotReady
          expr: kafka_backup_dr_ready == 0
          for: 15m
          labels:
            severity: critical
          annotations:
            summary: "DR cluster not ready"
            description: "DR cluster has not received recent backups"
```

### Grafana Dashboard

```json title="dr-dashboard.json"
{
  "dashboard": {
    "title": "Multi-Cluster DR Status",
    "panels": [
      {
        "title": "Backup Status",
        "type": "stat",
        "targets": [
          {
            "expr": "kafka_backup_last_successful_backup_timestamp"
          }
        ]
      },
      {
        "title": "Replication Lag",
        "type": "gauge",
        "targets": [
          {
            "expr": "time() - kafka_backup_last_successful_backup_timestamp"
          }
        ],
        "thresholds": {
          "steps": [
            { "value": 0, "color": "green" },
            { "value": 3600, "color": "yellow" },
            { "value": 7200, "color": "red" }
          ]
        }
      },
      {
        "title": "Backup Size Trend",
        "type": "graph",
        "targets": [
          {
            "expr": "kafka_backup_backup_size_bytes"
          }
        ]
      },
      {
        "title": "Records Backed Up",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(kafka_backup_records_total[1h])"
          }
        ]
      }
    ]
  }
}
```

## Testing DR

### Regular DR Drill

```bash
#!/bin/bash
# dr-drill.sh - Monthly DR test

echo "Starting DR Drill..."

# 1. Create test topic in primary
kafka-topics --create --topic dr-test-$(date +%Y%m%d) \
  --bootstrap-server primary-kafka:9092

# 2. Produce test messages
kafka-producer-perf-test \
  --topic dr-test-$(date +%Y%m%d) \
  --num-records 10000 \
  --record-size 1000 \
  --throughput -1 \
  --producer-props bootstrap.servers=primary-kafka:9092

# 3. Trigger backup
kafka-backup backup --config primary-backup.yaml

# 4. Wait for S3 replication
sleep 300

# 5. Restore to DR
kafka-backup restore --config dr-restore.yaml

# 6. Verify data in DR
COUNT=$(kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list dr-kafka:9092 \
  --topic dr-test-$(date +%Y%m%d) | awk -F: '{sum+=$3} END {print sum}')

if [ "$COUNT" -eq "10000" ]; then
  echo "DR Drill PASSED: All records restored"
else
  echo "DR Drill FAILED: Expected 10000, got $COUNT"
  exit 1
fi

# 7. Cleanup
kafka-topics --delete --topic dr-test-$(date +%Y%m%d) \
  --bootstrap-server primary-kafka:9092
kafka-topics --delete --topic dr-test-$(date +%Y%m%d) \
  --bootstrap-server dr-kafka:9092

echo "DR Drill Complete"
```

## Best Practices

1. **Automate backups** - Use scheduled backups via operator or cron
2. **Enable S3 replication** - Cross-region replication for DR bucket
3. **Test DR regularly** - Monthly DR drills
4. **Monitor replication lag** - Alert on backup and replication delays
5. **Document runbooks** - Clear procedures for failover/failback
6. **Secure credentials** - Use secrets management for all clusters
7. **Version control configs** - GitOps for backup/restore configurations

## Next Steps

- [Disaster Recovery Guide](../use-cases/disaster-recovery) - DR planning
- [Kubernetes Operator](../operator) - Operator setup
- [Compliance](../use-cases/compliance-audit) - Meeting compliance requirements
