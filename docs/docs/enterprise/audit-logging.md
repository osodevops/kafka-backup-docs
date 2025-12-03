---
title: Audit Logging
description: Comprehensive audit trails for OSO Kafka Backup Enterprise
sidebar_position: 4
---

# Audit Logging

OSO Kafka Backup Enterprise provides comprehensive audit logging for compliance and security monitoring.

## Overview

Audit logging captures:

- All backup operations
- All restore operations
- Configuration changes
- Access attempts (successful and denied)
- Administrative actions

## Configuration

### Basic Audit Configuration

```yaml
enterprise:
  audit:
    enabled: true

    # Where to send audit logs
    destination:
      type: file
      path: /var/log/kafka-backup/audit.log

    # What to log
    events:
      - backup.started
      - backup.completed
      - backup.failed
      - restore.started
      - restore.completed
      - restore.failed
      - access.denied
      - config.changed
```

### Audit Destinations

#### File

```yaml
enterprise:
  audit:
    destination:
      type: file
      path: /var/log/kafka-backup/audit.log
      rotation:
        max_size_mb: 100
        max_files: 10
        compress: true
```

#### S3

```yaml
enterprise:
  audit:
    destination:
      type: s3
      bucket: audit-logs
      prefix: kafka-backup/
      region: us-west-2
      # Logs are batched and uploaded periodically
      batch_interval_secs: 60
```

#### CloudWatch Logs

```yaml
enterprise:
  audit:
    destination:
      type: cloudwatch
      log_group: /kafka-backup/audit
      log_stream: ${HOSTNAME}
      region: us-west-2
```

#### Kafka Topic

```yaml
enterprise:
  audit:
    destination:
      type: kafka
      bootstrap_servers:
        - kafka:9092
      topic: audit-events
      security:
        security_protocol: SASL_SSL
        sasl_mechanism: SCRAM-SHA-256
        sasl_username: audit-producer
        sasl_password: ${AUDIT_KAFKA_PASSWORD}
```

#### Syslog

```yaml
enterprise:
  audit:
    destination:
      type: syslog
      server: syslog.company.com:514
      protocol: tcp  # or udp
      facility: local0
```

#### Webhook

```yaml
enterprise:
  audit:
    destination:
      type: webhook
      url: https://siem.company.com/ingest
      headers:
        Authorization: Bearer ${WEBHOOK_TOKEN}
      batch_size: 100
      retry_attempts: 3
```

### Multiple Destinations

```yaml
enterprise:
  audit:
    destinations:
      - type: file
        path: /var/log/kafka-backup/audit.log

      - type: s3
        bucket: audit-archive
        prefix: kafka-backup/

      - type: kafka
        bootstrap_servers:
          - kafka:9092
        topic: audit-events
```

## Audit Events

### Event Categories

| Category | Events |
|----------|--------|
| **Backup** | started, completed, failed, cancelled |
| **Restore** | started, completed, failed, cancelled |
| **Validate** | started, completed, failed |
| **Access** | granted, denied |
| **Config** | changed, viewed |
| **Auth** | login, logout, token_refresh |
| **Admin** | license_applied, feature_enabled |

### Event Configuration

```yaml
enterprise:
  audit:
    events:
      # Backup events
      - backup.started
      - backup.completed
      - backup.failed
      - backup.checkpoint  # Include progress checkpoints

      # Restore events
      - restore.started
      - restore.completed
      - restore.failed

      # Security events (always recommended)
      - access.denied
      - auth.login
      - auth.logout
      - auth.failed

      # Configuration events
      - config.changed

    # Exclude specific events
    exclude_events:
      - backup.checkpoint  # If too verbose
```

## Audit Log Format

### Standard Fields

Every audit event includes:

```json
{
  "timestamp": "2024-12-01T10:15:30.123Z",
  "event_type": "backup.completed",
  "event_id": "evt_abc123def456",
  "version": "1.0",

  "actor": {
    "type": "user",
    "id": "alice@company.com",
    "roles": ["backup-operator"],
    "ip_address": "10.0.0.50",
    "user_agent": "kafka-backup-cli/1.0.0"
  },

  "resource": {
    "type": "backup",
    "id": "production-backup-20241201",
    "path": "s3://kafka-backups/production/"
  },

  "action": {
    "operation": "backup",
    "result": "success",
    "duration_ms": 45000
  },

  "context": {
    "cluster_id": "prod-us-west-2",
    "environment": "production",
    "correlation_id": "req_xyz789"
  }
}
```

### Event-Specific Fields

#### Backup Events

```json
{
  "event_type": "backup.completed",
  "details": {
    "backup_id": "production-backup-20241201",
    "topics": ["orders", "payments", "users"],
    "records_backed_up": 1500000,
    "bytes_backed_up": 524288000,
    "compressed_bytes": 104857600,
    "compression_ratio": 5.0,
    "duration_secs": 120,
    "checkpoints": 4
  }
}
```

#### Restore Events

```json
{
  "event_type": "restore.completed",
  "details": {
    "backup_id": "production-backup-20241201",
    "target_cluster": "dr-us-east-1",
    "topics_restored": ["orders", "payments"],
    "records_restored": 1000000,
    "pitr_enabled": true,
    "time_window_start": "2024-12-01T00:00:00Z",
    "time_window_end": "2024-12-01T12:00:00Z",
    "topic_mapping": {
      "orders": "restored-orders"
    }
  }
}
```

#### Access Denied Events

```json
{
  "event_type": "access.denied",
  "details": {
    "operation": "restore",
    "resource": "topic:production-orders",
    "required_permission": "restore:topic:production-orders",
    "user_permissions": ["backup:*", "list:*"],
    "reason": "insufficient_permissions"
  }
}
```

#### Configuration Change Events

```json
{
  "event_type": "config.changed",
  "details": {
    "config_type": "backup",
    "changes": [
      {
        "field": "compression_level",
        "old_value": "3",
        "new_value": "6"
      },
      {
        "field": "topics.include",
        "old_value": ["orders"],
        "new_value": ["orders", "payments"]
      }
    ]
  }
}
```

## Compliance Features

### Immutable Logging

Ensure logs cannot be tampered with:

```yaml
enterprise:
  audit:
    destination:
      type: s3
      bucket: compliance-audit-logs
      object_lock: true  # Use S3 Object Lock

    integrity:
      signing:
        enabled: true
        algorithm: HMAC-SHA256
        key_env_var: AUDIT_SIGNING_KEY

      chain:
        enabled: true  # Chain signatures for tamper detection
```

### Log Format

```json
{
  "event": { /* normal event */ },
  "integrity": {
    "signature": "sha256:abc123...",
    "previous_signature": "sha256:xyz789...",
    "sequence_number": 12345
  }
}
```

### Retention Policies

```yaml
enterprise:
  audit:
    retention:
      min_days: 365  # Minimum retention (compliance)
      max_days: 2555  # Maximum retention (7 years)

    # S3 lifecycle
    lifecycle:
      - days: 90
        storage_class: STANDARD_IA
      - days: 365
        storage_class: GLACIER
```

## Searching and Analysis

### Structured Logging

All logs are JSON for easy parsing:

```bash
# Find all failed backups
cat audit.log | jq 'select(.event_type == "backup.failed")'

# Find access denied for user
cat audit.log | jq 'select(.event_type == "access.denied" and .actor.id == "bob@company.com")'

# Count events by type
cat audit.log | jq '.event_type' | sort | uniq -c
```

### CloudWatch Insights

```sql
-- Failed operations in last 24 hours
fields @timestamp, event_type, actor.id, details.error
| filter event_type like /failed/
| sort @timestamp desc
| limit 100

-- Access denied events
fields @timestamp, actor.id, details.operation, details.resource
| filter event_type = "access.denied"
| sort @timestamp desc
```

### Elasticsearch/OpenSearch

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "event_type": "restore.completed" } },
        { "range": { "timestamp": { "gte": "now-7d" } } }
      ]
    }
  },
  "aggs": {
    "by_user": {
      "terms": { "field": "actor.id.keyword" }
    }
  }
}
```

## Alerting

### Alert Configuration

```yaml
enterprise:
  audit:
    alerts:
      - name: backup-failure
        condition: "event_type == 'backup.failed'"
        severity: high
        notify:
          - type: slack
            webhook: ${SLACK_WEBHOOK}
          - type: pagerduty
            routing_key: ${PAGERDUTY_KEY}

      - name: access-denied-spike
        condition: "event_type == 'access.denied'"
        threshold: 10
        window: 5m
        severity: medium
        notify:
          - type: email
            to: security@company.com

      - name: unauthorized-restore
        condition: "event_type == 'restore.started' and context.environment == 'production'"
        severity: high
        notify:
          - type: slack
            channel: "#security-alerts"
```

### Alert Integrations

#### Slack

```yaml
notify:
  - type: slack
    webhook: ${SLACK_WEBHOOK}
    channel: "#kafka-alerts"
    template: |
      :warning: *{{ .event_type }}*
      User: {{ .actor.id }}
      Resource: {{ .resource.id }}
      Time: {{ .timestamp }}
```

#### PagerDuty

```yaml
notify:
  - type: pagerduty
    routing_key: ${PAGERDUTY_ROUTING_KEY}
    severity: "{{ .severity }}"
```

#### Email

```yaml
notify:
  - type: email
    smtp_server: smtp.company.com:587
    from: kafka-backup@company.com
    to:
      - ops@company.com
      - security@company.com
```

## Kubernetes Configuration

### ConfigMap for Audit Config

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: audit-config
  namespace: kafka-backup
data:
  audit.yaml: |
    enterprise:
      audit:
        enabled: true
        destination:
          type: s3
          bucket: audit-logs
        events:
          - backup.*
          - restore.*
          - access.denied
```

### Volume Mount for File Logging

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: audited-backup
spec:
  enterprise:
    audit:
      enabled: true
      destination:
        type: file
        path: /var/log/audit/kafka-backup.log

  # Mount persistent volume for audit logs
  volumes:
    - name: audit-logs
      persistentVolumeClaim:
        claimName: audit-logs-pvc
  volumeMounts:
    - name: audit-logs
      mountPath: /var/log/audit
```

## Best Practices

1. **Log to multiple destinations** - Redundancy for compliance
2. **Enable immutable storage** - Prevent tampering
3. **Set appropriate retention** - Meet compliance requirements
4. **Alert on security events** - Real-time monitoring
5. **Regular log review** - Periodic audit reviews
6. **Secure log access** - Limit who can read logs
7. **Include correlation IDs** - Trace requests across systems

## Sample Compliance Report

Generate compliance reports from audit logs:

```bash
#!/bin/bash
# Monthly compliance report

START_DATE=$(date -d "last month" +%Y-%m-01)
END_DATE=$(date -d "this month" +%Y-%m-01)

echo "=== Kafka Backup Audit Report ==="
echo "Period: $START_DATE to $END_DATE"
echo ""

echo "Backup Operations:"
cat audit.log | jq -r "select(.timestamp >= \"$START_DATE\" and .timestamp < \"$END_DATE\" and .event_type | startswith(\"backup\")) | .event_type" | sort | uniq -c

echo ""
echo "Restore Operations:"
cat audit.log | jq -r "select(.timestamp >= \"$START_DATE\" and .timestamp < \"$END_DATE\" and .event_type | startswith(\"restore\")) | .event_type" | sort | uniq -c

echo ""
echo "Access Denied Events:"
cat audit.log | jq -r "select(.timestamp >= \"$START_DATE\" and .timestamp < \"$END_DATE\" and .event_type == \"access.denied\") | \"\(.actor.id) - \(.details.operation) - \(.details.resource)\""
```

## Next Steps

- [RBAC Configuration](./rbac) - Access control
- [Compliance Guide](../use-cases/compliance-audit) - Meeting regulations
- [Security Setup](../guides/security-setup) - Secure configuration
