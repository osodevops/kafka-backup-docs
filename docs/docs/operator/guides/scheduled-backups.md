---
title: Scheduled Backups
description: Configure automated backup schedules with the Kubernetes Operator
sidebar_position: 1
---

# Scheduled Backups

Configure automated backup schedules using the KafkaBackup CRD's scheduling capabilities.

## Cron Schedule Format

The `schedule` field uses standard cron format:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

## Common Schedules

| Schedule | Cron Expression | Description |
|----------|-----------------|-------------|
| Every hour | `0 * * * *` | At minute 0 of every hour |
| Every 15 minutes | `*/15 * * * *` | Every 15 minutes |
| Every 6 hours | `0 */6 * * *` | At minute 0 past every 6th hour |
| Daily at midnight | `0 0 * * *` | Every day at 00:00 |
| Daily at 2 AM | `0 2 * * *` | Every day at 02:00 |
| Weekly (Sunday) | `0 0 * * 0` | Every Sunday at 00:00 |
| Monthly | `0 0 1 * *` | First day of month at 00:00 |

## Examples

### Hourly Backup

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: hourly-backup
  namespace: kafka-backup
spec:
  schedule: "0 * * * *"  # Every hour at minute 0

  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - orders
    - payments

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: hourly

  compression: zstd
  compressionLevel: 3

  retention:
    backups: 168  # Keep 7 days of hourly backups
```

### Daily Backup (Off-Peak Hours)

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: daily-backup
  namespace: kafka-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM

  kafkaCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256

  topics:
    - "*"  # All topics
  excludeTopics:
    - "__*"
    - "_*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: daily

  compression: zstd
  compressionLevel: 6  # Higher compression for archival

  retention:
    backups: 90  # Keep 90 days of daily backups
```

### Weekly Archival Backup

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: weekly-archive
  namespace: kafka-backup
spec:
  schedule: "0 3 * * 0"  # Weekly on Sunday at 3 AM

  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - "*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-archives
      region: us-west-2
      prefix: weekly

  compression: zstd
  compressionLevel: 9  # Maximum compression

  retention:
    backups: 52  # Keep 1 year of weekly backups
```

## Multi-Tier Backup Strategy

Implement comprehensive backup coverage:

```yaml
# Tier 1: Frequent backups for low RPO
---
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: tier1-frequent
spec:
  schedule: "*/15 * * * *"  # Every 15 minutes

  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - orders  # Critical topics only
    - payments

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      prefix: tier1-frequent

  compression: lz4  # Fast compression
  retention:
    backups: 96  # 24 hours of 15-minute backups

---
# Tier 2: Hourly backups for all topics
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: tier2-hourly
spec:
  schedule: "0 * * * *"  # Hourly

  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - "*"
  excludeTopics:
    - "__*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      prefix: tier2-hourly

  compression: zstd
  compressionLevel: 3
  retention:
    backups: 168  # 7 days

---
# Tier 3: Daily archival
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: tier3-daily
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM

  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - "*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-archives
      prefix: tier3-daily

  compression: zstd
  compressionLevel: 9
  retention:
    backups: 365  # 1 year
```

## One-Time Backup

For manual/on-demand backups, omit the schedule:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: manual-backup-20241201
spec:
  # No schedule - runs once immediately

  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  topics:
    - orders
    - payments

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      prefix: manual
```

## Trigger Manual Backup on Schedule

Force immediate execution of a scheduled backup:

```bash
# Add annotation to trigger backup
kubectl annotate kafkabackup hourly-backup \
  kafka.oso.sh/trigger-backup=$(date +%s) \
  --overwrite
```

## Backup Window Management

### Avoid Peak Hours

```yaml
spec:
  schedule: "0 2-5 * * *"  # Between 2 AM and 5 AM only
```

### Weekend-Only Archival

```yaml
spec:
  schedule: "0 3 * * 0,6"  # Saturday and Sunday at 3 AM
```

### Business Hours Exclusion

```yaml
# Backup every hour except 9 AM to 5 PM
spec:
  schedule: "0 0-8,18-23 * * *"
```

## Timezone Considerations

Kubernetes CronJobs use UTC by default. Adjust your schedule accordingly:

```yaml
# For 2 AM EST (UTC-5), schedule at 7 AM UTC
spec:
  schedule: "0 7 * * *"
```

Or use the `CRON_TZ` prefix (if supported):

```yaml
spec:
  schedule: "CRON_TZ=America/New_York 0 2 * * *"
```

## Retention Configuration

### By Count

```yaml
retention:
  backups: 168  # Keep last 168 backups
```

### S3 Lifecycle (Supplementary)

Configure S3 lifecycle for additional storage tiering:

```json
{
  "Rules": [
    {
      "ID": "BackupLifecycle",
      "Status": "Enabled",
      "Filter": {"Prefix": "hourly/"},
      "Transitions": [
        {"Days": 30, "StorageClass": "STANDARD_IA"},
        {"Days": 90, "StorageClass": "GLACIER"}
      ],
      "Expiration": {"Days": 365}
    }
  ]
}
```

## Monitoring Schedules

### Check Next Run Time

```bash
kubectl get kafkabackup hourly-backup \
  -o jsonpath='{.status.nextScheduledTime}'
```

### View Schedule History

```bash
kubectl get kafkabackup hourly-backup \
  -o jsonpath='{.status.backupHistory}' | jq
```

### Alert on Missed Backups

```yaml
# PrometheusRule
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: backup-schedule-alerts
spec:
  groups:
    - name: kafka-backup-schedule
      rules:
        - alert: BackupScheduleMissed
          expr: |
            (time() - kafka_backup_last_successful_backup_timestamp) >
            (kafka_backup_schedule_interval_seconds * 2)
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Backup schedule missed"
            description: "{{ $labels.backup_name }} hasn't run on schedule"
```

## Best Practices

1. **Stagger schedules** - Don't run all backups at the same time
2. **Use retention** - Prevent storage from growing unbounded
3. **Match frequency to RPO** - More frequent = lower data loss
4. **Use compression levels wisely** - Higher for archival, lower for frequent
5. **Monitor schedule adherence** - Alert on missed backups
6. **Test restores** - Regularly verify backups are usable

## Next Steps

- [GitOps Integration](./gitops) - Version control your backup configs
- [Secrets Guide](./secrets) - Configure credentials
- [KafkaBackup CRD](../crds/kafkabackup) - Full specification
