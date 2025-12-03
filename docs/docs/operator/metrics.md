---
title: Metrics
description: Prometheus metrics for the OSO Kafka Backup Operator
sidebar_position: 4
---

# Metrics

The OSO Kafka Backup Operator exposes Prometheus metrics for monitoring backup operations.

## Endpoints

| Endpoint | Port | Description |
|----------|------|-------------|
| `/metrics` | 8080 | Prometheus metrics |
| `/healthz` | 8081 | Liveness probe |
| `/readyz` | 8081 | Readiness probe |

## Enabling Metrics

### Helm Configuration

```yaml
metrics:
  enabled: true
  port: 8080
  path: /metrics

  serviceMonitor:
    enabled: true
    namespace: monitoring
    interval: 30s
    labels:
      release: prometheus
```

### ServiceMonitor

When `serviceMonitor.enabled: true`, a ServiceMonitor is created:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kafka-backup-operator
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kafka-backup-operator
  namespaceSelector:
    matchNames:
      - kafka-backup
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

## Metrics Reference

### Operator Metrics

#### Reconciliation Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_backup_operator_reconciliations_total` | Counter | Total reconciliation attempts |
| `kafka_backup_operator_reconciliation_errors_total` | Counter | Total reconciliation errors |
| `kafka_backup_operator_reconciliation_duration_seconds` | Histogram | Reconciliation duration |

Labels:
- `controller`: Controller name (backup, restore, offset_reset, offset_rollback)
- `namespace`: Resource namespace
- `name`: Resource name

#### Queue Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_backup_operator_workqueue_depth` | Gauge | Current queue depth |
| `kafka_backup_operator_workqueue_adds_total` | Counter | Items added to queue |
| `kafka_backup_operator_workqueue_retries_total` | Counter | Item retries |

### Backup Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_backup_backups_total` | Counter | Total backup operations |
| `kafka_backup_backup_duration_seconds` | Histogram | Backup duration |
| `kafka_backup_backup_size_bytes` | Gauge | Last backup size |
| `kafka_backup_backup_records_total` | Counter | Records backed up |
| `kafka_backup_last_successful_backup_timestamp` | Gauge | Timestamp of last success |

Labels:
- `backup_name`: KafkaBackup resource name
- `namespace`: Resource namespace
- `outcome`: success, failure

### Restore Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_backup_restores_total` | Counter | Total restore operations |
| `kafka_backup_restore_duration_seconds` | Histogram | Restore duration |
| `kafka_backup_restore_records_total` | Counter | Records restored |
| `kafka_backup_last_successful_restore_timestamp` | Gauge | Timestamp of last success |

Labels:
- `restore_name`: KafkaRestore resource name
- `namespace`: Resource namespace
- `outcome`: success, failure

### Offset Reset Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_backup_offset_resets_total` | Counter | Total offset reset operations |
| `kafka_backup_offset_reset_duration_seconds` | Histogram | Reset duration |
| `kafka_backup_offset_reset_groups_total` | Counter | Consumer groups reset |

Labels:
- `reset_name`: KafkaOffsetReset resource name
- `namespace`: Resource namespace
- `strategy`: earliest, latest, timestamp, offset, header_based
- `outcome`: success, failure

### Resource Status Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_backup_resource_status` | Gauge | Resource status (1=ready, 0=not ready) |
| `kafka_backup_resource_phase` | Gauge | Resource phase |

Labels:
- `kind`: KafkaBackup, KafkaRestore, etc.
- `name`: Resource name
- `namespace`: Namespace
- `phase`: Pending, Running, Completed, Failed

## Prometheus Queries

### Backup Success Rate

```promql
# Success rate over 24 hours
sum(rate(kafka_backup_backups_total{outcome="success"}[24h])) /
sum(rate(kafka_backup_backups_total[24h]))
```

### Backup Duration (p99)

```promql
histogram_quantile(0.99,
  sum(rate(kafka_backup_backup_duration_seconds_bucket[1h])) by (le, backup_name)
)
```

### Failed Backups

```promql
# Failed backups in last hour
sum(increase(kafka_backup_backups_total{outcome="failure"}[1h])) by (backup_name)
```

### Time Since Last Backup

```promql
# Time since last successful backup
time() - kafka_backup_last_successful_backup_timestamp
```

### Reconciliation Error Rate

```promql
sum(rate(kafka_backup_operator_reconciliation_errors_total[5m])) by (controller)
```

### Queue Depth

```promql
kafka_backup_operator_workqueue_depth
```

## Grafana Dashboards

### Import Dashboard

```json title="kafka-backup-dashboard.json"
{
  "dashboard": {
    "title": "Kafka Backup Operator",
    "panels": [
      {
        "title": "Backup Success Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(rate(kafka_backup_backups_total{outcome=\"success\"}[24h])) / sum(rate(kafka_backup_backups_total[24h])) * 100"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"value": 0, "color": "red"},
                {"value": 90, "color": "yellow"},
                {"value": 99, "color": "green"}
              ]
            }
          }
        }
      },
      {
        "title": "Backup Duration",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, sum(rate(kafka_backup_backup_duration_seconds_bucket[5m])) by (le, backup_name))",
            "legendFormat": "{{backup_name}} p99"
          },
          {
            "expr": "histogram_quantile(0.50, sum(rate(kafka_backup_backup_duration_seconds_bucket[5m])) by (le, backup_name))",
            "legendFormat": "{{backup_name}} p50"
          }
        ]
      },
      {
        "title": "Backup Size",
        "type": "timeseries",
        "targets": [
          {
            "expr": "kafka_backup_backup_size_bytes",
            "legendFormat": "{{backup_name}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "bytes"
          }
        }
      },
      {
        "title": "Time Since Last Backup",
        "type": "stat",
        "targets": [
          {
            "expr": "time() - kafka_backup_last_successful_backup_timestamp",
            "legendFormat": "{{backup_name}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                {"value": 0, "color": "green"},
                {"value": 3600, "color": "yellow"},
                {"value": 7200, "color": "red"}
              ]
            }
          }
        }
      },
      {
        "title": "Reconciliation Errors",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(kafka_backup_operator_reconciliation_errors_total[5m])) by (controller)",
            "legendFormat": "{{controller}}"
          }
        ]
      },
      {
        "title": "Records Backed Up",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(kafka_backup_backup_records_total[5m])) by (backup_name)",
            "legendFormat": "{{backup_name}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "records/s"
          }
        }
      }
    ]
  }
}
```

## Alerting Rules

### PrometheusRule

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kafka-backup-alerts
  namespace: monitoring
spec:
  groups:
    - name: kafka-backup
      rules:
        # Backup failed
        - alert: KafkaBackupFailed
          expr: increase(kafka_backup_backups_total{outcome="failure"}[1h]) > 0
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: "Kafka backup failed"
            description: "Backup {{ $labels.backup_name }} in {{ $labels.namespace }} failed"

        # No recent backup
        - alert: KafkaBackupMissing
          expr: time() - kafka_backup_last_successful_backup_timestamp > 7200
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "No recent Kafka backup"
            description: "No successful backup for {{ $labels.backup_name }} in 2 hours"

        # Backup taking too long
        - alert: KafkaBackupSlow
          expr: kafka_backup_backup_duration_seconds > 3600
          for: 0m
          labels:
            severity: warning
          annotations:
            summary: "Kafka backup is slow"
            description: "Backup {{ $labels.backup_name }} took more than 1 hour"

        # Operator reconciliation errors
        - alert: KafkaBackupOperatorErrors
          expr: rate(kafka_backup_operator_reconciliation_errors_total[5m]) > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Kafka backup operator errors"
            description: "Controller {{ $labels.controller }} has reconciliation errors"

        # Restore failed
        - alert: KafkaRestoreFailed
          expr: increase(kafka_backup_restores_total{outcome="failure"}[1h]) > 0
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: "Kafka restore failed"
            description: "Restore {{ $labels.restore_name }} in {{ $labels.namespace }} failed"
```

## Manual Metrics Access

### Port Forward

```bash
# Port forward to operator
kubectl port-forward -n kafka-backup deployment/kafka-backup-operator 8080:8080

# Fetch metrics
curl http://localhost:8080/metrics
```

### Sample Output

```
# HELP kafka_backup_backups_total Total number of backup operations
# TYPE kafka_backup_backups_total counter
kafka_backup_backups_total{backup_name="hourly-backup",namespace="kafka-backup",outcome="success"} 24
kafka_backup_backups_total{backup_name="hourly-backup",namespace="kafka-backup",outcome="failure"} 1

# HELP kafka_backup_backup_duration_seconds Duration of backup operations
# TYPE kafka_backup_backup_duration_seconds histogram
kafka_backup_backup_duration_seconds_bucket{backup_name="hourly-backup",le="60"} 10
kafka_backup_backup_duration_seconds_bucket{backup_name="hourly-backup",le="300"} 23
kafka_backup_backup_duration_seconds_bucket{backup_name="hourly-backup",le="600"} 24
kafka_backup_backup_duration_seconds_bucket{backup_name="hourly-backup",le="+Inf"} 25
kafka_backup_backup_duration_seconds_sum{backup_name="hourly-backup"} 2850
kafka_backup_backup_duration_seconds_count{backup_name="hourly-backup"} 25

# HELP kafka_backup_last_successful_backup_timestamp Timestamp of last successful backup
# TYPE kafka_backup_last_successful_backup_timestamp gauge
kafka_backup_last_successful_backup_timestamp{backup_name="hourly-backup",namespace="kafka-backup"} 1701432000
```

## Next Steps

- [Troubleshooting](./troubleshooting) - Debug operator issues
- [Configuration](./configuration) - Operator settings
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/) - Import dashboards
