---
title: Secrets
description: Configure Kubernetes Secrets for Kafka backup credentials
sidebar_position: 3
---

# Secrets Configuration

Configure Kubernetes Secrets for Kafka authentication and cloud storage credentials.

## Secret Types

| Secret | Purpose |
|--------|---------|
| Kafka SASL credentials | Username/password for Kafka |
| Kafka TLS certificates | CA cert, client cert, client key |
| S3 credentials | AWS access key and secret |
| Azure credentials | Connection string or service principal |
| GCS credentials | Service account JSON |

## Kafka Credentials

### SASL/SCRAM Credentials

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  username: backup-user
  password: your-secure-password
```

Reference in KafkaBackup:

```yaml
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
      usernameKey: username
      passwordKey: password
```

### TLS Certificates

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-tls
  namespace: kafka-backup
type: Opaque
data:
  ca.crt: <base64-encoded-ca-cert>
  tls.crt: <base64-encoded-client-cert>
  tls.key: <base64-encoded-client-key>
```

Create from files:

```bash
kubectl create secret generic kafka-tls \
  --namespace kafka-backup \
  --from-file=ca.crt=./ca.crt \
  --from-file=tls.crt=./client.crt \
  --from-file=tls.key=./client.key
```

Reference in KafkaBackup:

```yaml
spec:
  kafkaCluster:
    tlsSecret:
      name: kafka-tls
      caKey: ca.crt
      certKey: tls.crt
      keyKey: tls.key
```

### Combined SASL and TLS

```yaml
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9093
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
    tlsSecret:
      name: kafka-tls
```

## AWS S3 Credentials

### Static Credentials

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: s3-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  accessKey: AKIAIOSFODNN7EXAMPLE
  secretKey: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

Reference in KafkaBackup:

```yaml
spec:
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      credentialsSecret:
        name: s3-credentials
        accessKeyKey: accessKey
        secretKeyKey: secretKey
```

### IAM Role for Service Account (IRSA) - Recommended

No secret needed - use service account annotations:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup-operator
  namespace: kafka-backup
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/kafka-backup-role
```

IAM Policy:

```json
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

KafkaBackup without credentials (uses IRSA):

```yaml
spec:
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      # No credentialsSecret - uses IRSA
```

## Azure Blob Storage

### Connection String

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: azure-storage
  namespace: kafka-backup
type: Opaque
stringData:
  connectionString: "DefaultEndpointsProtocol=https;AccountName=mystorageaccount;AccountKey=...;EndpointSuffix=core.windows.net"
```

Reference:

```yaml
spec:
  storage:
    storageType: azure
    azure:
      container: kafka-backups
      connectionStringSecret:
        name: azure-storage
        key: connectionString
```

### Workload Identity - Recommended

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup-operator
  namespace: kafka-backup
  annotations:
    azure.workload.identity/client-id: <managed-identity-client-id>
  labels:
    azure.workload.identity/use: "true"
```

No secret needed - uses workload identity.

## Google Cloud Storage

### Service Account JSON

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gcs-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  credentials.json: |
    {
      "type": "service_account",
      "project_id": "my-project",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "kafka-backup@my-project.iam.gserviceaccount.com",
      "client_id": "...",
      ...
    }
```

Create from file:

```bash
kubectl create secret generic gcs-credentials \
  --namespace kafka-backup \
  --from-file=credentials.json=./service-account.json
```

Reference:

```yaml
spec:
  storage:
    storageType: gcs
    gcs:
      bucket: kafka-backups
      credentialsSecret:
        name: gcs-credentials
        key: credentials.json
```

### Workload Identity - Recommended

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup-operator
  namespace: kafka-backup
  annotations:
    iam.gke.io/gcp-service-account: kafka-backup@my-project.iam.gserviceaccount.com
```

No secret needed - uses workload identity.

## Secret Management Best Practices

### External Secrets Operator

Sync secrets from external providers:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: kafka-credentials
  namespace: kafka-backup
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: kafka-credentials
    template:
      type: Opaque
      data:
        username: "{{ .username }}"
        password: "{{ .password }}"
  data:
    - secretKey: username
      remoteRef:
        key: kafka/production/credentials
        property: username
    - secretKey: password
      remoteRef:
        key: kafka/production/credentials
        property: password
```

### Sealed Secrets

Encrypt secrets for GitOps:

```bash
# Create sealed secret
kubeseal --format yaml < kafka-credentials.yaml > kafka-credentials-sealed.yaml
```

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: kafka-credentials
  namespace: kafka-backup
spec:
  encryptedData:
    username: AgBy8hCiH...
    password: AgDk4kLmN...
```

### Vault Agent Injection

Inject secrets from HashiCorp Vault:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: backup-with-vault
spec:
  podTemplate:
    annotations:
      vault.hashicorp.com/agent-inject: "true"
      vault.hashicorp.com/role: "kafka-backup"
      vault.hashicorp.com/agent-inject-secret-kafka: "secret/data/kafka/credentials"
      vault.hashicorp.com/agent-inject-template-kafka: |
        {{- with secret "secret/data/kafka/credentials" -}}
        export KAFKA_USERNAME="{{ .Data.data.username }}"
        export KAFKA_PASSWORD="{{ .Data.data.password }}"
        {{- end }}
```

## Secret Rotation

### Automatic Rotation with External Secrets

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
spec:
  refreshInterval: 1h  # Check for updates hourly
```

### Manual Rotation

```bash
# Update secret
kubectl create secret generic kafka-credentials \
  --namespace kafka-backup \
  --from-literal=username=backup-user \
  --from-literal=password=new-secure-password \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart operator to pick up new credentials
kubectl rollout restart deployment/kafka-backup-operator -n kafka-backup
```

## Verifying Secrets

### Check Secret Exists

```bash
kubectl get secret kafka-credentials -n kafka-backup
```

### Verify Secret Keys

```bash
kubectl get secret kafka-credentials -n kafka-backup -o jsonpath='{.data}' | jq 'keys'
```

### Decode Secret Value

```bash
kubectl get secret kafka-credentials -n kafka-backup \
  -o jsonpath='{.data.password}' | base64 -d
```

## Troubleshooting

### Secret Not Found

```
Error: Secret 'kafka-credentials' not found
```

Solution:
```bash
# Check secret exists in correct namespace
kubectl get secrets -n kafka-backup

# Create if missing
kubectl create secret generic kafka-credentials ...
```

### Wrong Key Name

```
Error: Key 'user' not found in secret
```

Solution:
```yaml
# Check secret has correct keys
saslSecret:
  name: kafka-credentials
  usernameKey: username  # Must match actual key in secret
  passwordKey: password
```

### Permission Denied

```
Error: Cannot access secret
```

Solution:
```yaml
# Ensure operator has RBAC to read secrets
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "watch"]
```

## Complete Example

```yaml
# All secrets for production backup
---
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  username: backup-user
  password: ${KAFKA_PASSWORD}

---
apiVersion: v1
kind: Secret
metadata:
  name: kafka-tls
  namespace: kafka-backup
type: Opaque
data:
  ca.crt: ${BASE64_CA_CERT}

---
# S3 using IRSA, no secret needed

---
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: production-backup
  namespace: kafka-backup
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9093
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
    tlsSecret:
      name: kafka-tls
      caKey: ca.crt

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      # Uses IRSA from service account
```

## Next Steps

- [GitOps Integration](./gitops) - Secure secrets in Git
- [Scheduled Backups](./scheduled-backups) - Configure backup schedules
- [Security Setup](../../guides/security-setup) - Complete security configuration
