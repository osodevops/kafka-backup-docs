---
title: Kubernetes Deployment
description: Deploy OSO Kafka Backup on Kubernetes manually or with the Operator
sidebar_position: 4
---

# Kubernetes Deployment

Deploy OSO Kafka Backup on Kubernetes clusters. This guide covers manual deployment; for automated management, see the [Kubernetes Operator](../operator).

## Deployment Options

| Method | Use Case | Management |
|--------|----------|------------|
| **CronJob** | Scheduled backups | Manual |
| **Job** | One-time backup/restore | Manual |
| **Operator** | Production automation | GitOps/CRDs |

## Prerequisites

- Kubernetes 1.21+
- kubectl configured
- Kafka cluster accessible from K8s
- Storage (PVC or cloud credentials)

## CronJob Deployment

### Create Namespace

```bash
kubectl create namespace kafka-backup
```

### Create ConfigMap

```yaml title="configmap.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-backup-config
  namespace: kafka-backup
data:
  backup.yaml: |
    mode: backup
    backup_id: "k8s-daily-backup"

    source:
      bootstrap_servers:
        - kafka-0.kafka.kafka.svc:9092
        - kafka-1.kafka.kafka.svc:9092
        - kafka-2.kafka.kafka.svc:9092
      topics:
        include:
          - "*"
        exclude:
          - "__consumer_offsets"
          - "_schemas"

    storage:
      backend: filesystem
      path: "/data/backups"

    backup:
      compression: zstd
      compression_level: 3
      checkpoint_interval_secs: 30
      include_offset_headers: true
```

```bash
kubectl apply -f configmap.yaml
```

### Create PVC for Storage

```yaml title="pvc.yaml"
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: kafka-backup-storage
  namespace: kafka-backup
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: standard  # Adjust for your cluster
```

```bash
kubectl apply -f pvc.yaml
```

### Create CronJob

```yaml title="cronjob.yaml"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kafka-backup
  namespace: kafka-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: OnFailure
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            fsGroup: 1000
          containers:
            - name: kafka-backup
              image: ghcr.io/osodevops/kafka-backup:latest
              args:
                - backup
                - --config
                - /config/backup.yaml
              resources:
                requests:
                  cpu: 500m
                  memory: 512Mi
                limits:
                  cpu: 2000m
                  memory: 2Gi
              volumeMounts:
                - name: config
                  mountPath: /config
                  readOnly: true
                - name: data
                  mountPath: /data/backups
              securityContext:
                allowPrivilegeEscalation: false
                readOnlyRootFilesystem: true
                capabilities:
                  drop:
                    - ALL
          volumes:
            - name: config
              configMap:
                name: kafka-backup-config
            - name: data
              persistentVolumeClaim:
                claimName: kafka-backup-storage
```

```bash
kubectl apply -f cronjob.yaml
```

### Verify CronJob

```bash
# Check CronJob
kubectl get cronjob -n kafka-backup

# List Jobs
kubectl get jobs -n kafka-backup

# Check recent Pod logs
kubectl logs -n kafka-backup -l job-name=kafka-backup-<timestamp>
```

## S3 Storage Configuration

### Create Secret for AWS Credentials

```yaml title="aws-secret.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: aws-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: "AKIA..."
  AWS_SECRET_ACCESS_KEY: "..."
```

Or using IAM Roles for Service Accounts (IRSA):

```yaml title="serviceaccount.yaml"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup
  namespace: kafka-backup
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/kafka-backup-role
```

### Update ConfigMap for S3

```yaml
data:
  backup.yaml: |
    mode: backup
    backup_id: "k8s-daily-backup"

    source:
      bootstrap_servers:
        - kafka-0.kafka.kafka.svc:9092
      topics:
        include:
          - "*"

    storage:
      backend: s3
      bucket: my-kafka-backups
      region: us-west-2
      prefix: production/daily

    backup:
      compression: zstd
```

### Update CronJob for S3

```yaml
spec:
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: kafka-backup  # For IRSA
          containers:
            - name: kafka-backup
              envFrom:
                - secretRef:
                    name: aws-credentials  # Or use IRSA
```

## Azure Blob Storage Configuration

### Prerequisites

- AKS cluster with Workload Identity enabled
- Azure Key Vault for secret management
- Azure CSI Secrets Store Driver installed

### Install Azure CSI Secrets Store Driver

```bash
# Add Helm repo
helm repo add csi-secrets-store-provider-azure https://azure.github.io/secrets-store-csi-driver-provider-azure/charts
helm repo update

# Install the driver
helm install csi-secrets-store-provider-azure csi-secrets-store-provider-azure/csi-secrets-store-provider-azure \
  --namespace kube-system
```

### Create Managed Identity

```bash
# Create managed identity for Kafka Backup
az identity create \
  --name kafka-backup-identity \
  --resource-group <resource-group>

# Get identity client ID
CLIENT_ID=$(az identity show \
  --name kafka-backup-identity \
  --resource-group <resource-group> \
  --query clientId -o tsv)

# Assign Storage Blob Data Contributor role
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee $CLIENT_ID \
  --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Storage/storageAccounts/<storage-account>

# Grant Key Vault access
az keyvault set-policy \
  --name <key-vault-name> \
  --object-id $(az identity show --name kafka-backup-identity --resource-group <resource-group> --query principalId -o tsv) \
  --secret-permissions get list
```

### Create Federated Credential

```bash
# Get AKS OIDC issuer URL
AKS_OIDC_ISSUER=$(az aks show \
  --name <aks-cluster> \
  --resource-group <resource-group> \
  --query oidcIssuerProfile.issuerUrl -o tsv)

# Create federated credential
az identity federated-credential create \
  --name kafka-backup-federated \
  --identity-name kafka-backup-identity \
  --resource-group <resource-group> \
  --issuer $AKS_OIDC_ISSUER \
  --subject system:serviceaccount:kafka-backup:kafka-backup \
  --audience api://AzureADTokenExchange
```

### Create ServiceAccount with Workload Identity

```yaml title="serviceaccount.yaml"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup
  namespace: kafka-backup
  annotations:
    azure.workload.identity/client-id: <managed-identity-client-id>
  labels:
    azure.workload.identity/use: "true"
```

### Create SecretProviderClass

Use the Azure CSI Secrets Store Driver to sync secrets from Azure Key Vault:

```yaml title="secretproviderclass.yaml"
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: kafka-backup-secrets
  namespace: kafka-backup
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    clientID: <managed-identity-client-id>
    keyvaultName: <key-vault-name>
    tenantId: <azure-tenant-id>
    objects: |
      array:
        - |
          objectName: kafka-sasl-username
          objectType: secret
        - |
          objectName: kafka-sasl-password
          objectType: secret
        - |
          objectName: azure-storage-account-key
          objectType: secret
  secretObjects:
    - secretName: kafka-backup-secrets
      type: Opaque
      data:
        - objectName: kafka-sasl-username
          key: KAFKA_SASL_USERNAME
        - objectName: kafka-sasl-password
          key: KAFKA_SASL_PASSWORD
        - objectName: azure-storage-account-key
          key: AZURE_STORAGE_KEY
```

### Update ConfigMap for Azure Blob Storage

```yaml title="configmap-azure.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-backup-config
  namespace: kafka-backup
data:
  backup.yaml: |
    mode: backup
    backup_id: "k8s-daily-backup"

    source:
      bootstrap_servers:
        - <kafka-bootstrap-server>:9092
      security:
        security_protocol: SASL_SSL
        sasl_mechanism: PLAIN
        sasl_username: ${KAFKA_SASL_USERNAME}
        sasl_password: ${KAFKA_SASL_PASSWORD}
      topics:
        include:
          - "*"
        exclude:
          - "__consumer_offsets"
          - "_schemas"

    storage:
      backend: azure
      account_name: <storage-account-name>
      container_name: kafka-backups
      account_key: ${AZURE_STORAGE_KEY}
      prefix: production/daily

    backup:
      compression: zstd
      compression_level: 3
```

### Update CronJob for Azure

```yaml title="cronjob-azure.yaml"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kafka-backup
  namespace: kafka-backup
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            azure.workload.identity/use: "true"
        spec:
          serviceAccountName: kafka-backup
          restartPolicy: OnFailure
          containers:
            - name: kafka-backup
              image: ghcr.io/osodevops/kafka-backup:latest
              args:
                - backup
                - --config
                - /config/backup.yaml
              env:
                - name: KAFKA_SASL_USERNAME
                  valueFrom:
                    secretKeyRef:
                      name: kafka-backup-secrets
                      key: KAFKA_SASL_USERNAME
                - name: KAFKA_SASL_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: kafka-backup-secrets
                      key: KAFKA_SASL_PASSWORD
                - name: AZURE_STORAGE_KEY
                  valueFrom:
                    secretKeyRef:
                      name: kafka-backup-secrets
                      key: AZURE_STORAGE_KEY
              volumeMounts:
                - name: config
                  mountPath: /config
                  readOnly: true
                - name: secrets-store
                  mountPath: /mnt/secrets-store
                  readOnly: true
          volumes:
            - name: config
              configMap:
                name: kafka-backup-config
            - name: secrets-store
              csi:
                driver: secrets-store.csi.k8s.io
                readOnly: true
                volumeAttributes:
                  secretProviderClass: kafka-backup-secrets
```

### Using Workload Identity (No Storage Key)

For keyless authentication using Workload Identity:

```yaml title="configmap-azure-workload-identity.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: kafka-backup-config
  namespace: kafka-backup
data:
  backup.yaml: |
    mode: backup
    backup_id: "k8s-daily-backup"

    source:
      bootstrap_servers:
        - <kafka-bootstrap-server>:9092
      topics:
        include:
          - "*"

    storage:
      backend: azure
      account_name: <storage-account-name>
      container_name: kafka-backups
      use_workload_identity: true
      prefix: production/daily

    backup:
      compression: zstd
```

## Kafka Authentication

### SASL/SCRAM Authentication

```yaml title="kafka-secret.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  username: backup-user
  password: your-password
```

Update ConfigMap:

```yaml
data:
  backup.yaml: |
    source:
      bootstrap_servers:
        - kafka:9092
      security:
        security_protocol: SASL_SSL
        sasl_mechanism: SCRAM-SHA-256
        sasl_username: ${KAFKA_USERNAME}
        sasl_password: ${KAFKA_PASSWORD}
```

Update CronJob:

```yaml
containers:
  - name: kafka-backup
    env:
      - name: KAFKA_USERNAME
        valueFrom:
          secretKeyRef:
            name: kafka-credentials
            key: username
      - name: KAFKA_PASSWORD
        valueFrom:
          secretKeyRef:
            name: kafka-credentials
            key: password
```

### TLS Certificates

```yaml title="tls-secret.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: kafka-tls
  namespace: kafka-backup
type: Opaque
data:
  ca.crt: <base64-encoded-ca>
  client.crt: <base64-encoded-cert>
  client.key: <base64-encoded-key>
```

Mount in CronJob:

```yaml
volumeMounts:
  - name: tls
    mountPath: /certs
    readOnly: true
volumes:
  - name: tls
    secret:
      secretName: kafka-tls
```

## One-Time Job

For one-time backup or restore:

```yaml title="backup-job.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  name: kafka-backup-manual
  namespace: kafka-backup
spec:
  ttlSecondsAfterFinished: 86400  # Clean up after 24h
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: kafka-backup
          image: ghcr.io/osodevops/kafka-backup:latest
          args:
            - backup
            - --config
            - /config/backup.yaml
          volumeMounts:
            - name: config
              mountPath: /config
            - name: data
              mountPath: /data/backups
      volumes:
        - name: config
          configMap:
            name: kafka-backup-config
        - name: data
          persistentVolumeClaim:
            claimName: kafka-backup-storage
```

```bash
kubectl apply -f backup-job.yaml

# Watch job progress
kubectl logs -n kafka-backup -f job/kafka-backup-manual
```

## Restore Job

```yaml title="restore-job.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  name: kafka-restore
  namespace: kafka-backup
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: kafka-backup
          image: ghcr.io/osodevops/kafka-backup:latest
          args:
            - restore
            - --config
            - /config/restore.yaml
          volumeMounts:
            - name: config
              configMap:
                name: kafka-restore-config
                items:
                  - key: restore.yaml
                    path: restore.yaml
            - name: data
              mountPath: /data/backups
      volumes:
        - name: config
          configMap:
            name: kafka-restore-config
        - name: data
          persistentVolumeClaim:
            claimName: kafka-backup-storage
```

## Monitoring

### Pod Disruption Budget

```yaml title="pdb.yaml"
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: kafka-backup-pdb
  namespace: kafka-backup
spec:
  minAvailable: 0
  selector:
    matchLabels:
      app: kafka-backup
```

### ServiceMonitor (Prometheus)

```yaml title="servicemonitor.yaml"
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kafka-backup
  namespace: kafka-backup
spec:
  selector:
    matchLabels:
      app: kafka-backup
  endpoints:
    - port: metrics
      interval: 30s
```

## Resource Recommendations

| Cluster Size | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-------------|-------------|----------------|-----------|--------------|
| Small | 250m | 256Mi | 1000m | 1Gi |
| Medium | 500m | 512Mi | 2000m | 2Gi |
| Large | 1000m | 1Gi | 4000m | 4Gi |

## Troubleshooting

### Check Job Status

```bash
kubectl get jobs -n kafka-backup
kubectl describe job kafka-backup-manual -n kafka-backup
```

### View Logs

```bash
kubectl logs -n kafka-backup -l job-name=kafka-backup-<id> --tail=100
```

### Debug Pod

```bash
kubectl run -n kafka-backup debug --rm -it \
  --image=ghcr.io/osodevops/kafka-backup:latest \
  --restart=Never -- /bin/sh
```

## Next Steps

- [Kubernetes Operator](../operator) - Automated CRD-based management
- [Security Setup](../guides/security-setup) - TLS and SASL configuration
- [AWS S3 Setup](./cloud-setup/aws-s3) - S3 storage configuration
