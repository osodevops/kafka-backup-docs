---
title: Enterprise Overview
description: OSO Kafka Backup Enterprise features for large-scale deployments
sidebar_position: 1
---

# Enterprise Overview

OSO Kafka Backup Enterprise provides additional features for organizations with advanced security, compliance, and operational requirements.

## Enterprise vs. Open Source

| Feature | Open Source | Enterprise |
|---------|-------------|------------|
| Core backup/restore | Yes | Yes |
| All storage backends | Yes | Yes |
| PITR | Yes | Yes |
| Compression | Yes | Yes |
| SASL/TLS | Yes | Yes |
| **Field-level encryption** | No | Yes |
| **Data masking** | No | Yes |
| **RBAC** | No | Yes |
| **Audit logging** | No | Yes |
| **Schema Registry sync** | No | Yes |
| **WebAssembly plugins** | No | Yes |
| **Priority support** | Community | 24/7 SLA |

## Enterprise Features

### Field-Level Encryption

Encrypt sensitive fields within messages while keeping metadata and non-sensitive fields readable:

```yaml
enterprise:
  encryption:
    enabled: true
    fields:
      - path: "$.customer.ssn"
        algorithm: AES-256-GCM
      - path: "$.payment.card_number"
        algorithm: AES-256-GCM
```

[Learn more about Encryption](./encryption)

### Data Masking

Mask PII and sensitive data in non-production environments:

```yaml
enterprise:
  masking:
    enabled: true
    rules:
      - field: "$.email"
        type: email
      - field: "$.phone"
        type: phone
      - field: "$.name"
        type: name
```

[Learn more about Data Masking](./encryption#data-masking)

### Role-Based Access Control

Control who can perform backup and restore operations:

```yaml
enterprise:
  rbac:
    enabled: true
    policies:
      - role: backup-operator
        permissions:
          - backup:*
          - list:*
          - describe:*
      - role: restore-operator
        permissions:
          - restore:*
          - validate:*
```

[Learn more about RBAC](./rbac)

### Audit Logging

Comprehensive audit trails for compliance:

```yaml
enterprise:
  audit:
    enabled: true
    destination: s3://audit-logs/kafka-backup/
    events:
      - backup.started
      - backup.completed
      - restore.started
      - restore.completed
      - config.changed
```

[Learn more about Audit Logging](./audit-logging)

### Schema Registry Integration

Backup and restore Confluent Schema Registry:

```yaml
enterprise:
  schema_registry:
    enabled: true
    url: https://schema-registry:8081
    backup_schemas: true
    restore_schemas: true
```

[Learn more about Schema Registry](./schema-registry)

### WebAssembly Plugins

Extend functionality with custom plugins:

```yaml
enterprise:
  plugins:
    - name: custom-transformer
      path: /plugins/transformer.wasm
      config:
        key: value
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OSO Kafka Backup Enterprise                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Core Engine                              │    │
│  │  (Backup, Restore, PITR, Compression, Storage)              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│        ┌────────────────────┴────────────────────┐                  │
│        ▼                                         ▼                   │
│  ┌──────────────┐                         ┌──────────────┐          │
│  │  Enterprise  │                         │  Enterprise  │          │
│  │  Security    │                         │  Operations  │          │
│  │              │                         │              │          │
│  │ • Encryption │                         │ • Audit Log  │          │
│  │ • Masking    │                         │ • RBAC       │          │
│  │ • RBAC       │                         │ • Plugins    │          │
│  └──────────────┘                         └──────────────┘          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Plugin Runtime (WASM)                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │
│  │  │Transform│  │ Filter  │  │ Encrypt │  │ Custom  │         │    │
│  │  │ Plugin  │  │ Plugin  │  │ Plugin  │  │ Plugin  │         │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Getting Enterprise

### Trial License

Request a 30-day trial:

```bash
# Request trial license
kafka-backup license request --email your@company.com

# Apply license
kafka-backup license apply --file license.key
```

### License Installation

```yaml
enterprise:
  license:
    key: ${ENTERPRISE_LICENSE_KEY}
    # Or file path
    file: /etc/kafka-backup/license.key
```

### Kubernetes Installation

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-backup-license
  namespace: kafka-backup
type: Opaque
stringData:
  license.key: |
    -----BEGIN LICENSE-----
    ...
    -----END LICENSE-----
```

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: enterprise-backup
spec:
  enterprise:
    licenseSecret:
      name: kafka-backup-license
      key: license.key
```

## Enterprise Support

### Support Tiers

| Tier | Response Time | Channels | Hours |
|------|---------------|----------|-------|
| Standard | 8 hours | Email, Portal | Business hours |
| Premium | 4 hours | Email, Portal, Slack | Business hours |
| Mission Critical | 1 hour | All + Phone | 24/7 |

### Support Resources

- **Documentation**: Comprehensive enterprise docs
- **Knowledge Base**: Searchable issue database
- **Training**: Custom training sessions
- **Architecture Review**: Solution design assistance

### Contact

- Email: enterprise@oso.sh
- Portal: https://support.oso.sh
- Phone (Mission Critical): Available with contract

## Compliance

Enterprise features help meet:

| Regulation | Relevant Features |
|------------|-------------------|
| **GDPR** | Encryption, masking, audit logs, data deletion |
| **HIPAA** | Encryption, access control, audit trails |
| **SOC 2** | RBAC, audit logging, security controls |
| **PCI-DSS** | Field encryption, access logging, key management |
| **SOX** | Audit trails, access controls, data integrity |

## Migration from Open Source

### Step 1: Obtain License

Contact sales or request trial.

### Step 2: Apply License

```bash
kafka-backup license apply --file enterprise.license
```

### Step 3: Enable Features

```yaml
# Add enterprise configuration to existing config
enterprise:
  license:
    file: /etc/kafka-backup/enterprise.license

  # Enable desired features
  encryption:
    enabled: true
    # ...

  audit:
    enabled: true
    # ...
```

### Step 4: Validate

```bash
kafka-backup license info

# Output:
# License: Valid
# Type: Enterprise
# Features: encryption, masking, rbac, audit, schema-registry, plugins
# Expires: 2025-12-31
```

## Next Steps

- [Field-Level Encryption](./encryption) - Protect sensitive data
- [RBAC Configuration](./rbac) - Access control setup
- [Audit Logging](./audit-logging) - Compliance logging
- [Schema Registry](./schema-registry) - Schema sync
- [Licensing](./licensing) - License management
