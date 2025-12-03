---
title: Schema Registry
description: Backup and restore Confluent Schema Registry with OSO Kafka Backup Enterprise
sidebar_position: 5
---

# Schema Registry Integration

OSO Kafka Backup Enterprise supports backing up and restoring Confluent Schema Registry alongside your Kafka data.

## Overview

Schema Registry integration provides:

- Backup all schemas with your Kafka data
- Restore schemas before restoring messages
- Maintain schema compatibility during migration
- Support for Avro, JSON Schema, and Protobuf

## Why Backup Schema Registry?

```
Without Schema Backup:
┌─────────────────┐     ┌─────────────────┐
│  Kafka Cluster  │     │ Schema Registry │
│                 │     │                 │
│  Messages ──────┼─────┼── Schema IDs    │
│  (serialized)   │     │  (references)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
    ✓ Backed up              ✗ NOT backed up
         │                       │
         ▼                       ▼
    Restore fails: "Schema ID 42 not found"
```

```
With Schema Backup:
┌─────────────────┐     ┌─────────────────┐
│  Kafka Cluster  │     │ Schema Registry │
│                 │     │                 │
│  Messages ──────┼─────┼── Schema IDs    │
│  (serialized)   │     │  (references)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
    ✓ Backed up              ✓ Backed up
         │                       │
         ▼                       ▼
    Restore succeeds with correct schemas
```

## Configuration

### Basic Schema Registry Backup

```yaml
enterprise:
  schema_registry:
    enabled: true
    url: https://schema-registry:8081

    # Authentication (if required)
    auth:
      type: basic
      username: ${SR_USERNAME}
      password: ${SR_PASSWORD}
```

### Complete Configuration

```yaml
mode: backup
backup_id: "full-backup-with-schemas"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - "*"

storage:
  backend: s3
  bucket: kafka-backups
  prefix: production

enterprise:
  schema_registry:
    enabled: true
    url: https://schema-registry:8081

    # Authentication
    auth:
      type: basic
      username: ${SR_USERNAME}
      password: ${SR_PASSWORD}

    # TLS configuration
    tls:
      ca_cert: /certs/ca.crt
      client_cert: /certs/client.crt
      client_key: /certs/client.key

    # What to backup
    backup:
      subjects: "*"  # All subjects, or specific patterns
      include_soft_deleted: false
      include_versions: all  # or: latest

    # Restore behavior
    restore:
      enabled: true
      strategy: preserve  # preserve, overwrite, skip
      id_mapping: true  # Maintain schema ID references
```

## Authentication

### Basic Auth

```yaml
enterprise:
  schema_registry:
    auth:
      type: basic
      username: admin
      password: ${SR_PASSWORD}
```

### mTLS

```yaml
enterprise:
  schema_registry:
    url: https://schema-registry:8081
    auth:
      type: mtls
    tls:
      ca_cert: /certs/ca.crt
      client_cert: /certs/client.crt
      client_key: /certs/client.key
```

### OAuth/OIDC

```yaml
enterprise:
  schema_registry:
    auth:
      type: oauth
      token_url: https://auth.company.com/oauth/token
      client_id: ${SR_CLIENT_ID}
      client_secret: ${SR_CLIENT_SECRET}
      scope: schema-registry
```

## Backup Process

### What Gets Backed Up

| Item | Description |
|------|-------------|
| **Subjects** | All schema subjects |
| **Versions** | All versions per subject |
| **Schemas** | The actual schema definitions |
| **Compatibility** | Compatibility settings per subject |
| **Mode** | Import/ReadOnly mode |
| **References** | Schema references (for complex schemas) |

### Backup Storage Structure

```
backup/
├── manifest.json
├── kafka/
│   └── (kafka data segments)
└── schema-registry/
    ├── _schemas.json          # Global settings
    ├── subjects/
    │   ├── orders-value/
    │   │   ├── metadata.json  # Subject settings
    │   │   ├── v1.avsc        # Schema version 1
    │   │   ├── v2.avsc        # Schema version 2
    │   │   └── ...
    │   ├── payments-value/
    │   │   └── ...
    │   └── ...
    └── config/
        └── global.json        # Global compatibility
```

### Schema Manifest

```json
{
  "schema_registry_version": "7.5.0",
  "backup_timestamp": "2024-12-01T10:00:00Z",
  "subjects": [
    {
      "name": "orders-value",
      "schema_type": "AVRO",
      "compatibility": "BACKWARD",
      "versions": [
        {
          "version": 1,
          "id": 1,
          "schema_file": "subjects/orders-value/v1.avsc"
        },
        {
          "version": 2,
          "id": 5,
          "schema_file": "subjects/orders-value/v2.avsc"
        }
      ]
    }
  ],
  "id_mapping": {
    "1": "subjects/orders-value/v1.avsc",
    "5": "subjects/orders-value/v2.avsc"
  }
}
```

## Restore Process

### Restore Order

```
1. Restore Schema Registry
   ├── Create subjects
   ├── Register schemas (with ID mapping)
   └── Set compatibility levels

2. Restore Kafka Data
   ├── Messages reference schema IDs
   └── IDs now exist in target registry
```

### Restore Strategies

#### Preserve (Default)

Keep existing schemas, only add missing:

```yaml
enterprise:
  schema_registry:
    restore:
      strategy: preserve
      # Existing subject "orders-value" with v1, v2
      # Backup has v1, v2, v3
      # Result: v1, v2 unchanged, v3 added
```

#### Overwrite

Replace existing schemas:

```yaml
enterprise:
  schema_registry:
    restore:
      strategy: overwrite
      # Warning: May break existing consumers
```

#### Skip

Don't restore schemas that already exist:

```yaml
enterprise:
  schema_registry:
    restore:
      strategy: skip
      # Only restore to empty subjects
```

### Schema ID Mapping

The critical challenge: Schema IDs may differ between registries.

```
Source Registry:
  orders-value v1 → ID: 1
  orders-value v2 → ID: 5
  payments-value v1 → ID: 2

Target Registry (empty):
  orders-value v1 → ID: 1   (same!)
  orders-value v2 → ID: 2   (different!)
  payments-value v1 → ID: 3 (different!)
```

OSO Kafka Backup handles this automatically:

```yaml
enterprise:
  schema_registry:
    restore:
      id_mapping: true

      # Option 1: Rewrite message schema IDs (recommended)
      rewrite_ids: true

      # Option 2: Force original IDs (requires empty registry)
      force_ids: false
```

With `rewrite_ids: true`:

```
Message in backup:
  Magic byte + Schema ID 5 + Avro data

Message after restore:
  Magic byte + Schema ID 2 + Avro data
  (ID rewritten to match target registry)
```

## Subject Selection

### Backup Specific Subjects

```yaml
enterprise:
  schema_registry:
    backup:
      subjects:
        - "orders-*"
        - "payments-*"
        - "users-value"
```

### Exclude Subjects

```yaml
enterprise:
  schema_registry:
    backup:
      subjects: "*"
      exclude:
        - "*-test"
        - "internal-*"
```

### Map Subjects During Restore

```yaml
enterprise:
  schema_registry:
    restore:
      subject_mapping:
        "orders-value": "restored-orders-value"
        "payments-value": "restored-payments-value"
```

## Schema Types

### Avro

```yaml
enterprise:
  schema_registry:
    enabled: true
    # Avro is default, no special config needed
```

### JSON Schema

```yaml
enterprise:
  schema_registry:
    schema_types:
      - AVRO
      - JSON
```

### Protobuf

```yaml
enterprise:
  schema_registry:
    schema_types:
      - AVRO
      - PROTOBUF

    protobuf:
      # Include dependent .proto files
      include_dependencies: true
```

### Schema References

For schemas that reference other schemas:

```json
{
  "schema": "...",
  "references": [
    {
      "name": "common.Address",
      "subject": "common-address-value",
      "version": 1
    }
  ]
}
```

These references are preserved during backup/restore.

## Verification

### Verify Schema Backup

```bash
kafka-backup describe \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --format json | jq '.schema_registry'
```

Output:

```json
{
  "enabled": true,
  "subjects_count": 25,
  "schemas_count": 48,
  "subjects": [
    {
      "name": "orders-value",
      "versions": 3,
      "latest_id": 15
    }
  ]
}
```

### Verify Schema Restore

```bash
# List subjects in target registry
curl -u admin:password https://target-sr:8081/subjects

# Compare schema counts
curl https://source-sr:8081/subjects | jq length
curl https://target-sr:8081/subjects | jq length
```

## Kubernetes Configuration

### Secrets for Schema Registry

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: schema-registry-credentials
  namespace: kafka-backup
type: Opaque
stringData:
  username: admin
  password: your-password
```

### Operator Configuration

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: backup-with-schemas
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9092

  enterprise:
    licenseSecret:
      name: kafka-backup-license

    schemaRegistry:
      enabled: true
      url: https://schema-registry:8081
      credentialsSecret:
        name: schema-registry-credentials
        usernameKey: username
        passwordKey: password
```

## Migration Scenarios

### Same Schema IDs Required

For consumers that can't be updated:

```yaml
enterprise:
  schema_registry:
    restore:
      # Requires empty target registry
      force_ids: true
```

### ID Rewriting (Recommended)

For most migrations:

```yaml
enterprise:
  schema_registry:
    restore:
      rewrite_ids: true
      # Messages are modified during restore
      # Target registry assigns new IDs
      # Message schema ID references updated
```

### Manual ID Mapping

For complex scenarios:

```yaml
enterprise:
  schema_registry:
    restore:
      id_mapping_file: /config/id-mapping.json

# id-mapping.json:
# {
#   "1": 100,
#   "5": 101,
#   "2": 102
# }
```

## Troubleshooting

### Schema Registration Failed

```
Error: Schema registration failed for subject orders-value
Cause: Schema is incompatible with an earlier schema
```

**Solution:**

```yaml
enterprise:
  schema_registry:
    restore:
      # Option 1: Change compatibility
      set_compatibility: NONE

      # Option 2: Force schema (dangerous)
      force_register: true
```

### Schema ID Not Found

```
Error: Schema ID 42 not found in target registry
```

**Solution:** Ensure schemas are restored before Kafka data:

```yaml
enterprise:
  schema_registry:
    restore:
      enabled: true
      # Schemas restored first automatically
```

### Reference Not Found

```
Error: Reference to subject 'common-address-value' not found
```

**Solution:** Include referenced subjects:

```yaml
enterprise:
  schema_registry:
    backup:
      subjects:
        - "orders-*"
        - "common-*"  # Include referenced subjects
      include_references: true
```

## Best Practices

1. **Always backup schemas with data** - They're tightly coupled
2. **Use ID rewriting for migrations** - Most compatible approach
3. **Test schema restore first** - Before restoring data
4. **Include all referenced schemas** - For complex schemas
5. **Document compatibility settings** - Know your requirements
6. **Verify after restore** - Check schema counts and IDs

## Next Steps

- [Migration Guide](../use-cases/migration) - Full migration process
- [Encryption](./encryption) - Protect schema content
- [Troubleshooting](../troubleshooting/common-errors) - Common issues
