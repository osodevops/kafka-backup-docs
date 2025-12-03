---
title: Configuration
description: Configure the OSO Kafka Backup Operator
sidebar_position: 3
---

# Configuration

Configure the OSO Kafka Backup Operator using Helm values.

## Helm Values Reference

### Complete Values File

```yaml title="values.yaml"
# Replica count for HA
replicaCount: 1

# Image configuration
image:
  repository: osodevops/kafka-backup-operator
  tag: ""  # Defaults to chart appVersion
  pullPolicy: IfNotPresent

# Image pull secrets
imagePullSecrets: []
  # - name: my-registry-secret

# Override names
nameOverride: ""
fullnameOverride: ""

# Service account configuration
serviceAccount:
  create: true
  annotations: {}
    # eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/kafka-backup
  name: ""  # Defaults to release name

# Pod annotations
podAnnotations: {}
  # prometheus.io/scrape: "true"
  # prometheus.io/port: "8080"

# Pod security context
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

# Container security context
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

# Resource limits
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

# Node selector
nodeSelector: {}
  # kubernetes.io/os: linux

# Tolerations
tolerations: []
  # - key: "dedicated"
  #   operator: "Equal"
  #   value: "kafka-backup"
  #   effect: "NoSchedule"

# Affinity rules
affinity: {}
  # podAntiAffinity:
  #   preferredDuringSchedulingIgnoredDuringExecution:
  #     - weight: 100
  #       podAffinityTerm:
  #         labelSelector:
  #           matchLabels:
  #             app.kubernetes.io/name: kafka-backup-operator
  #         topologyKey: kubernetes.io/hostname

# CRD configuration
crds:
  install: true
  keep: false  # Keep CRDs on uninstall

# Leader election for HA
leaderElection:
  enabled: true
  leaseDuration: 15s
  renewDeadline: 10s
  retryPeriod: 2s

# Metrics configuration
metrics:
  enabled: true
  port: 8080
  path: /metrics

  # Prometheus ServiceMonitor
  serviceMonitor:
    enabled: false
    namespace: ""  # Defaults to release namespace
    interval: 30s
    scrapeTimeout: 10s
    labels: {}
      # release: prometheus

# Health probes
health:
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8081
    initialDelaySeconds: 15
    periodSeconds: 20
  readinessProbe:
    httpGet:
      path: /readyz
      port: 8081
    initialDelaySeconds: 5
    periodSeconds: 10

# Logging configuration
logging:
  level: info  # debug, info, warn, error
  format: json  # json or text

# Pod disruption budget
podDisruptionBudget:
  enabled: false
  minAvailable: 1
  # maxUnavailable: 1

# Network policy
networkPolicy:
  enabled: false
  # ingress:
  #   - from:
  #       - namespaceSelector:
  #           matchLabels:
  #             name: monitoring

# Extra environment variables
env: []
  # - name: RUST_LOG
  #   value: "debug"

# Extra volumes
extraVolumes: []
  # - name: certs
  #   secret:
  #     secretName: kafka-tls

# Extra volume mounts
extraVolumeMounts: []
  # - name: certs
  #   mountPath: /certs
  #   readOnly: true
```

## Configuration Sections

### Operator Replicas

For high availability:

```yaml
replicaCount: 2

leaderElection:
  enabled: true  # Required for multiple replicas
```

### Image Configuration

```yaml
image:
  repository: osodevops/kafka-backup-operator
  tag: "1.0.0"  # Specific version
  pullPolicy: IfNotPresent

# For private registries
imagePullSecrets:
  - name: my-registry-secret
```

### Resource Management

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

Guidelines:
- Memory: 128Mi minimum, 512Mi recommended
- CPU: 100m minimum, scale based on backup frequency

### Service Account

```yaml
serviceAccount:
  create: true
  name: kafka-backup-operator

  # AWS IRSA
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/kafka-backup

  # Azure Workload Identity
  annotations:
    azure.workload.identity/client-id: <client-id>

  # GCP Workload Identity
  annotations:
    iam.gke.io/gcp-service-account: kafka-backup@project.iam.gserviceaccount.com
```

### Security

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

### Metrics and Monitoring

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

### Logging

```yaml
logging:
  level: info   # debug for troubleshooting
  format: json  # json recommended for log aggregation

# Or via environment variable
env:
  - name: RUST_LOG
    value: "kafka_backup_operator=debug"
```

### Health Probes

```yaml
health:
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8081
    initialDelaySeconds: 15
    periodSeconds: 20
    timeoutSeconds: 5
    failureThreshold: 3

  readinessProbe:
    httpGet:
      path: /readyz
      port: 8081
    initialDelaySeconds: 5
    periodSeconds: 10
    timeoutSeconds: 5
    failureThreshold: 3
```

### Pod Scheduling

```yaml
nodeSelector:
  kubernetes.io/os: linux
  node-type: worker

tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "kafka-backup"
    effect: "NoSchedule"

affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: node-type
              operator: In
              values:
                - worker
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: kafka-backup-operator
          topologyKey: kubernetes.io/hostname
```

### Extra Mounts

For TLS certificates or custom configuration:

```yaml
extraVolumes:
  - name: kafka-tls
    secret:
      secretName: kafka-tls-certs
  - name: custom-config
    configMap:
      name: kafka-backup-config

extraVolumeMounts:
  - name: kafka-tls
    mountPath: /certs/kafka
    readOnly: true
  - name: custom-config
    mountPath: /config
    readOnly: true
```

## Environment-Specific Configurations

### Development

```yaml title="values-dev.yaml"
replicaCount: 1

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 256Mi

logging:
  level: debug

metrics:
  enabled: true
  serviceMonitor:
    enabled: false
```

### Production

```yaml title="values-prod.yaml"
replicaCount: 2

resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi

logging:
  level: info

metrics:
  enabled: true
  serviceMonitor:
    enabled: true
    labels:
      release: prometheus

podDisruptionBudget:
  enabled: true
  minAvailable: 1

affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app.kubernetes.io/name: kafka-backup-operator
        topologyKey: kubernetes.io/hostname
```

### Air-Gapped

```yaml title="values-airgapped.yaml"
image:
  repository: internal-registry.company.com/kafka-backup-operator
  pullPolicy: Always

imagePullSecrets:
  - name: internal-registry-creds

# Disable external endpoints
metrics:
  serviceMonitor:
    enabled: false
```

## Applying Configuration

### Installation

```bash
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --values values-prod.yaml
```

### Upgrade

```bash
helm upgrade kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --values values-prod.yaml
```

### View Current Values

```bash
helm get values kafka-backup-operator -n kafka-backup
```

### View All Values (including defaults)

```bash
helm get values kafka-backup-operator -n kafka-backup --all
```

## Configuration Validation

### Dry Run

```bash
helm install kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --values values.yaml \
  --dry-run
```

### Template Output

```bash
helm template kafka-backup-operator oso/kafka-backup-operator \
  --namespace kafka-backup \
  --values values.yaml
```

## Next Steps

- [Metrics](./metrics) - Prometheus metrics reference
- [Secrets Guide](./guides/secrets) - Configure credentials
- [KafkaBackup CRD](./crds/kafkabackup) - Create backups
