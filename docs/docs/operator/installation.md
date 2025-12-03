---
title: Installation
description: Install the OSO Kafka Backup Operator
sidebar_position: 2
---

# Installation

Install the OSO Kafka Backup Operator in your Kubernetes cluster.

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- kubectl configured to access your cluster
- Cluster admin permissions

## Helm Installation

### Add Helm Repository

```bash
helm repo add oso https://charts.oso.sh
helm repo update
```

### Install Operator

```bash
# Create namespace
kubectl create namespace kafka-backup

# Install with default values
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup
```

### Verify Installation

```bash
# Check operator pod
kubectl get pods -n kafka-backup

# Check CRDs installed
kubectl get crds | grep kafka.oso.sh

# Expected output:
# kafkabackups.kafka.oso.sh
# kafkarestores.kafka.oso.sh
# kafkaoffsetresets.kafka.oso.sh
# kafkaoffsetrollbacks.kafka.oso.sh
```

## Installation Options

### Custom Values

```bash
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --set replicaCount=2 \
  --set resources.requests.memory=256Mi \
  --set metrics.enabled=true
```

### Values File

```yaml title="values.yaml"
replicaCount: 2

image:
  repository: osodevops/kafka-backup-operator
  tag: "1.0.0"
  pullPolicy: IfNotPresent

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

metrics:
  enabled: true
  serviceMonitor:
    enabled: true

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
```

```bash
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --values values.yaml
```

### Install Specific Version

```bash
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --version 0.1.0
```

## CRD Installation

### Default (with Helm)

CRDs are installed automatically by Helm.

### CRDs Only

If you need to install CRDs separately (e.g., for GitOps):

```bash
# Install CRDs only
kubectl apply -f https://raw.githubusercontent.com/osodevops/kafka-backup-operator/main/deploy/crds/
```

### Keep CRDs on Uninstall

By default, CRDs are deleted when uninstalling. To keep them:

```yaml
crds:
  install: true
  keep: true  # Don't delete on uninstall
```

## RBAC Configuration

### Default Service Account

The operator creates a service account with required permissions:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup-operator
  namespace: kafka-backup
```

### Required Permissions

The operator needs these permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kafka-backup-operator
rules:
  # Manage CRDs
  - apiGroups: ["kafka.oso.sh"]
    resources: ["kafkabackups", "kafkarestores", "kafkaoffsetresets", "kafkaoffsetrollbacks"]
    verbs: ["*"]
  - apiGroups: ["kafka.oso.sh"]
    resources: ["kafkabackups/status", "kafkarestores/status", "kafkaoffsetresets/status", "kafkaoffsetrollbacks/status"]
    verbs: ["get", "patch", "update"]

  # Create jobs for backups
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["*"]

  # Read secrets
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "watch"]

  # Manage pods (for job pods)
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]

  # Events
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "patch"]
```

### Custom Service Account

```yaml
serviceAccount:
  create: true
  name: "my-kafka-backup-sa"
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/kafka-backup-role
```

## Cloud Provider Setup

### AWS (EKS)

#### IAM Role for Service Account (IRSA)

```bash
# Create IAM policy
aws iam create-policy \
  --policy-name KafkaBackupPolicy \
  --policy-document file://policy.json

# Create IAM role with OIDC
eksctl create iamserviceaccount \
  --name kafka-backup-operator \
  --namespace kafka-backup \
  --cluster my-cluster \
  --attach-policy-arn arn:aws:iam::123456789:policy/KafkaBackupPolicy \
  --approve
```

```json title="policy.json"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::kafka-backups",
        "arn:aws:s3:::kafka-backups/*"
      ]
    }
  ]
}
```

#### Helm Values for IRSA

```yaml
serviceAccount:
  create: false
  name: kafka-backup-operator
  # Service account created by eksctl
```

### Azure (AKS)

#### Workload Identity

```bash
# Enable workload identity on AKS
az aks update \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --enable-oidc-issuer \
  --enable-workload-identity

# Create managed identity
az identity create \
  --name kafka-backup-identity \
  --resource-group myResourceGroup

# Assign role
az role assignment create \
  --assignee <identity-client-id> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<account>
```

### GCP (GKE)

#### Workload Identity

```bash
# Enable workload identity on GKE
gcloud container clusters update my-cluster \
  --workload-pool=PROJECT_ID.svc.id.goog

# Create GCP service account
gcloud iam service-accounts create kafka-backup-sa

# Bind to Kubernetes service account
gcloud iam service-accounts add-iam-policy-binding \
  kafka-backup-sa@PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:PROJECT_ID.svc.id.goog[kafka-backup/kafka-backup-operator]"
```

## High Availability

### Multiple Replicas

```yaml
replicaCount: 2

# Leader election is enabled by default
leaderElection:
  enabled: true
  leaseDuration: 15s
  renewDeadline: 10s
  retryPeriod: 2s
```

### Pod Disruption Budget

```yaml
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

### Affinity Rules

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: kafka-backup-operator
          topologyKey: kubernetes.io/hostname
```

## Upgrade

### Helm Upgrade

```bash
# Update repo
helm repo update

# Upgrade operator
helm upgrade kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --values values.yaml
```

### CRD Updates

CRDs are updated automatically during Helm upgrade. To update CRDs manually:

```bash
kubectl apply -f https://raw.githubusercontent.com/osodevops/kafka-backup-operator/main/deploy/crds/
```

## Uninstall

### Helm Uninstall

```bash
helm uninstall kafka-backup-operator --namespace kafka-backup
```

### Clean Up CRDs

If CRDs were not kept:

```bash
kubectl delete crds kafkabackups.kafka.oso.sh
kubectl delete crds kafkarestores.kafka.oso.sh
kubectl delete crds kafkaoffsetresets.kafka.oso.sh
kubectl delete crds kafkaoffsetrollbacks.kafka.oso.sh
```

### Clean Up Namespace

```bash
kubectl delete namespace kafka-backup
```

## Troubleshooting Installation

### Operator Not Starting

```bash
# Check pod logs
kubectl logs -n kafka-backup deployment/kafka-backup-operator

# Check events
kubectl get events -n kafka-backup --sort-by='.lastTimestamp'
```

### CRDs Not Found

```bash
# Verify CRDs exist
kubectl get crds | grep kafka

# Reinstall CRDs
helm upgrade kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --set crds.install=true
```

### Permission Denied

```bash
# Check RBAC
kubectl auth can-i create kafkabackups --as=system:serviceaccount:kafka-backup:kafka-backup-operator

# Check cluster role binding
kubectl get clusterrolebinding | grep kafka-backup
```

## Next Steps

- [Configuration](./configuration) - Configure operator settings
- [Secrets Guide](./guides/secrets) - Set up credentials
- [KafkaBackup CRD](./crds/kafkabackup) - Create your first backup
