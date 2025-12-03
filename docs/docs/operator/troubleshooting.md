---
title: Troubleshooting
description: Troubleshoot the OSO Kafka Backup Operator
sidebar_position: 5
---

# Operator Troubleshooting

This guide helps troubleshoot common issues with the Kafka Backup Operator.

## Diagnostic Commands

### Check Operator Status

```bash
# Operator pods
kubectl get pods -n kafka-backup -l app.kubernetes.io/name=kafka-backup-operator

# Operator logs
kubectl logs -n kafka-backup deployment/kafka-backup-operator

# Follow logs
kubectl logs -n kafka-backup deployment/kafka-backup-operator -f

# Previous container logs (if restarted)
kubectl logs -n kafka-backup deployment/kafka-backup-operator --previous
```

### Check CRD Resources

```bash
# List all backup resources
kubectl get kafkabackups -A

# Describe specific backup
kubectl describe kafkabackup my-backup -n kafka-backup

# Get backup YAML with status
kubectl get kafkabackup my-backup -n kafka-backup -o yaml

# List all CRDs
kubectl get crds | grep kafka.oso.sh
```

### Check Events

```bash
# Events in namespace
kubectl get events -n kafka-backup --sort-by='.lastTimestamp'

# Events for specific resource
kubectl get events -n kafka-backup --field-selector involvedObject.name=my-backup
```

## Common Issues

### Operator Not Starting

**Symptoms:**
- Operator pod in CrashLoopBackOff or Error state

**Check:**
```bash
kubectl describe pod -n kafka-backup -l app.kubernetes.io/name=kafka-backup-operator
kubectl logs -n kafka-backup deployment/kafka-backup-operator --previous
```

**Common Causes:**

1. **Missing CRDs**
```bash
# Check CRDs exist
kubectl get crds | grep kafka.oso.sh

# Reinstall CRDs
helm upgrade kafka-backup-operator oso/kafka-backup-operator \
  --set crds.install=true
```

2. **Insufficient permissions**
```bash
# Check RBAC
kubectl auth can-i list kafkabackups --as=system:serviceaccount:kafka-backup:kafka-backup-operator

# Check ClusterRoleBinding
kubectl get clusterrolebinding | grep kafka-backup
```

3. **Resource limits too low**
```yaml
resources:
  requests:
    memory: 256Mi  # Increase if OOMKilled
  limits:
    memory: 512Mi
```

### Backup Not Running

**Symptoms:**
- KafkaBackup resource created but no backup job running
- Status shows "Pending" indefinitely

**Check:**
```bash
kubectl get kafkabackup my-backup -o yaml | grep -A 20 status
kubectl get jobs -n kafka-backup | grep my-backup
```

**Common Causes:**

1. **Schedule not triggered yet**
```yaml
# Check schedule
spec:
  schedule: "0 * * * *"  # Next hour

# For immediate backup, remove schedule or create one-time backup
```

2. **Previous job still running**
```bash
# Check for running jobs
kubectl get jobs -n kafka-backup

# Delete stuck job
kubectl delete job my-backup-job-xyz -n kafka-backup
```

3. **Invalid configuration**
```bash
# Check events
kubectl get events -n kafka-backup --field-selector involvedObject.name=my-backup

# Common: missing secret, wrong topic name, invalid storage config
```

### Backup Failing

**Symptoms:**
- KafkaBackup status shows "Failed"
- Job completed with error

**Check:**
```bash
# Get job pod logs
kubectl logs -n kafka-backup job/my-backup-job-xyz

# Describe job
kubectl describe job my-backup-job-xyz -n kafka-backup
```

**Common Causes:**

1. **Kafka connection failed**
```
Error: Failed to connect to Kafka broker
```
```yaml
# Verify bootstrap servers
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka.default.svc:9092  # Correct service name and port
```

2. **Authentication failed**
```
Error: SASL authentication failed
```
```yaml
# Check secret exists and has correct keys
kubectl get secret kafka-credentials -n kafka-backup -o yaml

# Verify secret reference
spec:
  kafkaCluster:
    saslSecret:
      name: kafka-credentials
      usernameKey: username  # Must match secret key
      passwordKey: password  # Must match secret key
```

3. **Storage access denied**
```
Error: Access denied to S3 bucket
```
```bash
# Check IAM/credentials
kubectl get secret s3-credentials -n kafka-backup

# For IRSA, check service account
kubectl describe sa kafka-backup-operator -n kafka-backup
```

4. **Topic not found**
```
Error: Topic 'my-topic' not found
```
```bash
# Verify topic exists in Kafka
kubectl exec -it kafka-0 -- kafka-topics --list --bootstrap-server localhost:9092
```

### Restore Not Working

**Symptoms:**
- KafkaRestore stuck in "Running" or fails

**Check:**
```bash
kubectl get kafkarestore my-restore -o yaml
kubectl logs -n kafka-backup job/my-restore-job-xyz
```

**Common Causes:**

1. **Backup not found**
```
Error: Backup 'backup-xyz' not found
```
```yaml
# List available backups
kafka-backup list --path s3://bucket/prefix

# Check backupId matches
spec:
  backupId: "backup-20241201-120000"  # Exact ID
```

2. **Target cluster unreachable**
```
Error: Failed to connect to target cluster
```
```yaml
spec:
  targetCluster:
    bootstrapServers:
      - target-kafka:9092  # Verify accessibility
```

3. **PITR time range invalid**
```
Error: No records found in time range
```
```yaml
spec:
  pitr:
    enabled: true
    # Verify timestamp is within backup range
    timestamp: "2024-12-01T12:00:00Z"
```

### Offset Reset Issues

**Symptoms:**
- Offset reset completes but consumers still at wrong position

**Check:**
```bash
kubectl get kafkaoffsetreset my-reset -o yaml

# Verify consumer group positions
kafka-consumer-groups --bootstrap-server kafka:9092 --group my-group --describe
```

**Common Causes:**

1. **Consumers still running**
```bash
# Stop consumers before reset
kubectl scale deployment my-consumer --replicas=0

# Then run reset
```

2. **Wrong strategy**
```yaml
spec:
  strategy: headerBased  # Requires offset headers in messages
  # Use timestamp if headers not available
  strategy: timestamp
  timestamp: "2024-12-01T12:00:00Z"
```

3. **Consumer group doesn't exist**
```yaml
spec:
  consumerGroups:
    - my-consumer-group  # Must match exact group ID
```

### Secret Access Issues

**Symptoms:**
- "Secret not found" or "key not found" errors

**Check:**
```bash
# List secrets
kubectl get secrets -n kafka-backup

# Check secret contents
kubectl get secret kafka-credentials -n kafka-backup -o yaml
```

**Fix:**
```yaml
# Ensure secret exists in same namespace as KafkaBackup
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: kafka-backup  # Same namespace!
type: Opaque
stringData:
  username: myuser
  password: mypassword
```

### CRD Validation Errors

**Symptoms:**
- Error when creating/updating resources
- "spec.xxx: Invalid value" messages

**Check:**
```bash
# Validate YAML
kubectl apply -f backup.yaml --dry-run=client

# Check CRD schema
kubectl explain kafkabackup.spec
kubectl explain kafkabackup.spec.storage
```

**Common validation errors:**

```yaml
# Wrong: Missing required field
spec:
  kafkaCluster:
    # bootstrapServers is required!

# Right:
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
```

```yaml
# Wrong: Invalid enum value
spec:
  storage:
    storageType: s4  # Invalid

# Right:
spec:
  storage:
    storageType: s3  # s3, azure, gcs, pvc
```

## Debug Mode

### Enable Debug Logging

```yaml
# Helm values
logging:
  level: debug

# Or via environment
env:
  - name: RUST_LOG
    value: "kafka_backup_operator=debug,kafka_backup=debug"
```

### Restart Operator with Debug

```bash
kubectl rollout restart deployment/kafka-backup-operator -n kafka-backup
kubectl logs -n kafka-backup deployment/kafka-backup-operator -f
```

## Resource Status Reference

### KafkaBackup Status

| Phase | Description |
|-------|-------------|
| `Pending` | Waiting for next scheduled run |
| `Running` | Backup in progress |
| `Completed` | Backup finished successfully |
| `Failed` | Backup failed |

### KafkaRestore Status

| Phase | Description |
|-------|-------------|
| `Pending` | Waiting to start |
| `Running` | Restore in progress |
| `Completed` | Restore finished successfully |
| `Failed` | Restore failed |

### Conditions

```yaml
status:
  conditions:
    - type: Ready
      status: "True"
      reason: BackupCompleted
      message: "Backup completed successfully"
      lastTransitionTime: "2024-12-01T12:00:00Z"
```

## Getting Help

### Gather Diagnostics

```bash
#!/bin/bash
# collect-diagnostics.sh

NAMESPACE="kafka-backup"
OUTPUT_DIR="kafka-backup-diagnostics"

mkdir -p $OUTPUT_DIR

# Operator logs
kubectl logs -n $NAMESPACE deployment/kafka-backup-operator > $OUTPUT_DIR/operator.log

# All resources
kubectl get kafkabackups -A -o yaml > $OUTPUT_DIR/kafkabackups.yaml
kubectl get kafkarestores -A -o yaml > $OUTPUT_DIR/kafkarestores.yaml
kubectl get kafkaoffsetresets -A -o yaml > $OUTPUT_DIR/kafkaoffsetresets.yaml
kubectl get kafkaoffsetrollbacks -A -o yaml > $OUTPUT_DIR/kafkaoffsetrollbacks.yaml

# Jobs
kubectl get jobs -n $NAMESPACE -o yaml > $OUTPUT_DIR/jobs.yaml

# Events
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' > $OUTPUT_DIR/events.txt

# Pods
kubectl get pods -n $NAMESPACE -o yaml > $OUTPUT_DIR/pods.yaml

# Secrets (names only)
kubectl get secrets -n $NAMESPACE > $OUTPUT_DIR/secrets.txt

# Create archive
tar -czf kafka-backup-diagnostics.tar.gz $OUTPUT_DIR
echo "Diagnostics saved to kafka-backup-diagnostics.tar.gz"
```

### Support

- [GitHub Issues](https://github.com/osodevops/kafka-backup-operator/issues)
- [Support Guide](../troubleshooting/support)

## Next Steps

- [Common Errors](../troubleshooting/common-errors) - CLI error reference
- [Metrics](./metrics) - Monitor operator health
- [Configuration](./configuration) - Operator settings
