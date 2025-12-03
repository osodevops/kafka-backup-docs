---
title: GitOps
description: Manage Kafka backups using GitOps workflows
sidebar_position: 2
---

# GitOps Integration

Manage your Kafka backup configurations using GitOps principles with tools like ArgoCD, Flux, or similar.

## GitOps Benefits

- **Version controlled** - Track all changes to backup configurations
- **Auditable** - Know who changed what and when
- **Reproducible** - Same configuration across environments
- **Declarative** - Desired state in Git
- **Automated** - Changes automatically applied

## Repository Structure

### Recommended Layout

```
kafka-backup-gitops/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   └── operator/
│       └── kustomization.yaml
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   ├── kafka-backup.yaml
│   │   └── secrets.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   ├── kafka-backup.yaml
│   │   └── secrets.yaml
│   └── production/
│       ├── kustomization.yaml
│       ├── kafka-backup.yaml
│       └── secrets.yaml
└── README.md
```

### Base Configuration

```yaml title="base/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - operator/
```

```yaml title="base/namespace.yaml"
apiVersion: v1
kind: Namespace
metadata:
  name: kafka-backup
```

### Environment Overlays

```yaml title="overlays/production/kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: kafka-backup

resources:
  - ../../base
  - kafka-backup.yaml

secretGenerator:
  - name: kafka-credentials
    files:
      - username=secrets/kafka-username.txt
      - password=secrets/kafka-password.txt

configMapGenerator:
  - name: backup-config
    literals:
      - ENVIRONMENT=production
```

## ArgoCD Integration

### Application Definition

```yaml title="argocd/kafka-backup-app.yaml"
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kafka-backup-production
  namespace: argocd
spec:
  project: default

  source:
    repoURL: https://github.com/myorg/kafka-backup-gitops.git
    targetRevision: main
    path: overlays/production

  destination:
    server: https://kubernetes.default.svc
    namespace: kafka-backup

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### ApplicationSet for Multiple Environments

```yaml title="argocd/kafka-backup-appset.yaml"
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: kafka-backup
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - environment: dev
            cluster: dev-cluster
          - environment: staging
            cluster: staging-cluster
          - environment: production
            cluster: production-cluster

  template:
    metadata:
      name: 'kafka-backup-{{environment}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/kafka-backup-gitops.git
        targetRevision: main
        path: 'overlays/{{environment}}'
      destination:
        server: '{{cluster}}'
        namespace: kafka-backup
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

## Flux Integration

### GitRepository

```yaml title="flux/git-repo.yaml"
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: kafka-backup
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myorg/kafka-backup-gitops.git
  ref:
    branch: main
  secretRef:
    name: github-credentials
```

### Kustomization

```yaml title="flux/kustomization.yaml"
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: kafka-backup-production
  namespace: flux-system
spec:
  interval: 10m
  path: ./overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: kafka-backup
  healthChecks:
    - apiVersion: kafka.oso.sh/v1alpha1
      kind: KafkaBackup
      name: production-backup
      namespace: kafka-backup
```

## Secret Management

### Sealed Secrets

```yaml title="overlays/production/sealed-secrets.yaml"
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: kafka-credentials
  namespace: kafka-backup
spec:
  encryptedData:
    username: AgBy8hCi...  # Encrypted
    password: AgDk4kLm...  # Encrypted
  template:
    metadata:
      name: kafka-credentials
```

Create sealed secret:
```bash
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

### External Secrets Operator

```yaml title="overlays/production/external-secret.yaml"
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
  data:
    - secretKey: username
      remoteRef:
        key: kafka/production
        property: username
    - secretKey: password
      remoteRef:
        key: kafka/production
        property: password
```

### SOPS Encryption

```yaml title="overlays/production/secrets.enc.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
type: Opaque
stringData:
  username: ENC[AES256_GCM,data:...,type:str]
  password: ENC[AES256_GCM,data:...,type:str]
sops:
  kms:
    - arn: arn:aws:kms:us-west-2:123456789:key/abc123
  version: 3.7.3
```

Configure Flux for SOPS:
```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: kafka-backup-production
spec:
  decryption:
    provider: sops
    secretRef:
      name: sops-gpg
```

## Environment Configuration

### Development

```yaml title="overlays/dev/kafka-backup.yaml"
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: dev-backup
spec:
  schedule: "0 */4 * * *"  # Every 4 hours

  kafkaCluster:
    bootstrapServers:
      - kafka.dev.svc:9092

  topics:
    - "*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups-dev
      region: us-west-2
      prefix: dev

  compression: lz4  # Fast
  retention:
    backups: 24  # 4 days
```

### Production

```yaml title="overlays/production/kafka-backup.yaml"
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: production-backup
spec:
  schedule: "0 * * * *"  # Hourly

  kafkaCluster:
    bootstrapServers:
      - kafka-0.kafka.svc:9092
      - kafka-1.kafka.svc:9092
      - kafka-2.kafka.svc:9092
    securityProtocol: SASL_SSL
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
    tlsSecret:
      name: kafka-tls

  topics:
    - "*"
  excludeTopics:
    - "__*"

  storage:
    storageType: s3
    s3:
      bucket: kafka-backups-production
      region: us-west-2
      prefix: production/hourly

  compression: zstd
  compressionLevel: 3
  includeOffsetHeaders: true
  sourceClusterId: "production"

  retention:
    backups: 168  # 7 days

  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2
      memory: 4Gi
```

## PR Workflow

### Pull Request Template

```markdown title=".github/pull_request_template.md"
## Kafka Backup Change

### Type of Change
- [ ] New backup configuration
- [ ] Schedule change
- [ ] Topic change
- [ ] Storage configuration change
- [ ] Other

### Description


### Checklist
- [ ] Tested in dev environment
- [ ] Retention policy reviewed
- [ ] Storage costs estimated
- [ ] Security reviewed (no plain text secrets)
```

### GitHub Actions Validation

```yaml title=".github/workflows/validate.yaml"
name: Validate Kafka Backup Config

on:
  pull_request:
    paths:
      - 'overlays/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Kustomize
        uses: imranismail/setup-kustomize@v2

      - name: Validate Kustomize
        run: |
          for dir in overlays/*/; do
            echo "Validating $dir"
            kustomize build "$dir" > /dev/null
          done

      - name: Validate CRDs
        run: |
          # Install kubeconform
          wget https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz
          tar xf kubeconform-linux-amd64.tar.gz

          for dir in overlays/*/; do
            echo "Validating CRDs in $dir"
            kustomize build "$dir" | ./kubeconform -strict
          done
```

## Change Management

### Promoting Changes

```bash
# Dev -> Staging
git checkout staging
git merge dev
git push

# Staging -> Production (after validation)
git checkout main
git merge staging
git tag release-$(date +%Y%m%d)
git push --tags
```

### Rollback

```bash
# ArgoCD
argocd app rollback kafka-backup-production

# Flux
flux suspend kustomization kafka-backup-production
git revert HEAD
git push
flux resume kustomization kafka-backup-production

# Or simply
git revert HEAD
git push
```

## Monitoring GitOps

### ArgoCD Metrics

```yaml
# Alert on sync failures
- alert: ArgoCDSyncFailed
  expr: argocd_app_info{sync_status!="Synced"} == 1
  for: 5m
  labels:
    severity: warning
```

### Flux Notifications

```yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta2
kind: Alert
metadata:
  name: kafka-backup-alerts
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: error
  eventSources:
    - kind: Kustomization
      name: kafka-backup-production
```

## Best Practices

1. **Never commit plain text secrets** - Use sealed secrets, external secrets, or SOPS
2. **Use environment overlays** - Different configs for dev/staging/production
3. **Review all changes** - Require PR reviews for production changes
4. **Automated validation** - CI pipeline validates configs
5. **Gradual rollout** - Test in dev before production
6. **Document changes** - Clear commit messages and PR descriptions
7. **Tag releases** - Version your production deployments

## Next Steps

- [Secrets Guide](./secrets) - Secure credential management
- [Scheduled Backups](./scheduled-backups) - Backup scheduling
- [Installation](../installation) - Operator setup
