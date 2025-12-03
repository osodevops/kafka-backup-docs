---
title: Field-Level Encryption
description: Encrypt sensitive fields in Kafka messages during backup
sidebar_position: 2
---

# Field-Level Encryption

OSO Kafka Backup Enterprise provides field-level encryption to protect sensitive data within messages while keeping the overall message structure readable.

## Overview

Field-level encryption allows you to:

- Encrypt specific fields (SSN, credit card, etc.)
- Keep metadata and non-sensitive fields readable
- Decrypt on restore when needed
- Comply with data protection regulations

```
Original Message:
{
  "order_id": "12345",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",    ← Encrypt
    "ssn": "123-45-6789"            ← Encrypt
  },
  "amount": 99.99
}

Encrypted Backup:
{
  "order_id": "12345",
  "customer": {
    "name": "John Doe",
    "email": "ENC[AES256:abc123...]",
    "ssn": "ENC[AES256:def456...]"
  },
  "amount": 99.99
}
```

## Configuration

### Basic Encryption

```yaml
enterprise:
  encryption:
    enabled: true
    key_provider: env
    key_env_var: ENCRYPTION_KEY

    fields:
      - path: "$.customer.ssn"
      - path: "$.customer.email"
      - path: "$.payment.card_number"
```

### Key Providers

#### Environment Variable

```yaml
enterprise:
  encryption:
    key_provider: env
    key_env_var: ENCRYPTION_KEY

# Set the key (32 bytes for AES-256)
export ENCRYPTION_KEY="your-32-byte-encryption-key-here"
```

#### AWS KMS

```yaml
enterprise:
  encryption:
    key_provider: aws-kms
    kms_key_id: "arn:aws:kms:us-west-2:123456789:key/12345678-1234-1234-1234-123456789012"
    kms_region: us-west-2
```

#### Azure Key Vault

```yaml
enterprise:
  encryption:
    key_provider: azure-keyvault
    keyvault_url: "https://myvault.vault.azure.net"
    keyvault_key_name: "kafka-backup-key"
```

#### HashiCorp Vault

```yaml
enterprise:
  encryption:
    key_provider: hashicorp-vault
    vault_addr: "https://vault.example.com:8200"
    vault_path: "secret/data/kafka-backup"
    vault_key_name: "encryption_key"
```

#### File-Based

```yaml
enterprise:
  encryption:
    key_provider: file
    key_file: /etc/kafka-backup/encryption.key

# Key file should contain raw key bytes or base64
```

## Field Selection

### JSONPath Syntax

Use JSONPath to select fields:

```yaml
fields:
  # Direct field
  - path: "$.email"

  # Nested field
  - path: "$.customer.ssn"

  # Array element
  - path: "$.items[*].price"

  # Wildcard
  - path: "$.*.secret"

  # Deep wildcard
  - path: "$..password"
```

### Examples

```yaml
# E-commerce order
fields:
  - path: "$.customer.email"
  - path: "$.customer.phone"
  - path: "$.payment.card_number"
  - path: "$.payment.cvv"
  - path: "$.shipping.address"

# Healthcare record
fields:
  - path: "$.patient.ssn"
  - path: "$.patient.date_of_birth"
  - path: "$.diagnosis[*].details"
  - path: "$..notes"

# Financial transaction
fields:
  - path: "$.account_number"
  - path: "$.routing_number"
  - path: "$.beneficiary.tax_id"
```

## Encryption Algorithms

### Supported Algorithms

| Algorithm | Key Size | Use Case |
|-----------|----------|----------|
| AES-256-GCM | 256 bit | Default, recommended |
| AES-128-GCM | 128 bit | Faster, still secure |
| ChaCha20-Poly1305 | 256 bit | Alternative to AES |

### Algorithm Configuration

```yaml
enterprise:
  encryption:
    enabled: true
    default_algorithm: AES-256-GCM

    fields:
      - path: "$.ssn"
        algorithm: AES-256-GCM

      - path: "$.large_blob"
        algorithm: ChaCha20-Poly1305  # Better for large data
```

## Topic-Specific Encryption

Different encryption for different topics:

```yaml
enterprise:
  encryption:
    enabled: true

    topics:
      - pattern: "orders*"
        fields:
          - path: "$.customer.email"
          - path: "$.payment.card_number"

      - pattern: "healthcare*"
        fields:
          - path: "$.patient.ssn"
          - path: "$..diagnosis"

      - pattern: "financial*"
        fields:
          - path: "$.account_number"
          - path: "$.routing_number"
```

## Restore Behavior

### Decryption on Restore

By default, encrypted fields are decrypted during restore:

```yaml
mode: restore

enterprise:
  encryption:
    decrypt_on_restore: true  # Default
    key_provider: aws-kms
    kms_key_id: "arn:aws:kms:..."
```

### Keep Encrypted

To keep fields encrypted after restore:

```yaml
enterprise:
  encryption:
    decrypt_on_restore: false
```

### Re-encrypt with Different Key

```yaml
enterprise:
  encryption:
    decrypt_on_restore: true

    # Re-encrypt with new key for target environment
    re_encrypt:
      enabled: true
      key_provider: aws-kms
      kms_key_id: "arn:aws:kms:us-east-1:..."  # Different key
```

## Key Rotation

### Automatic Key Rotation

With KMS providers, key rotation is handled automatically:

```bash
# AWS KMS - enable automatic rotation
aws kms enable-key-rotation --key-id 12345678-...

# Backups use current key version
# Restore can use any key version (KMS handles it)
```

### Manual Key Rotation

```yaml
enterprise:
  encryption:
    key_provider: env
    key_env_var: ENCRYPTION_KEY

    # For manual rotation, keep old keys accessible
    old_keys:
      - env_var: ENCRYPTION_KEY_V1
      - env_var: ENCRYPTION_KEY_V2
```

Restore will try keys in order until one works.

## Data Masking

For non-production environments, mask instead of encrypt:

```yaml
enterprise:
  masking:
    enabled: true

    rules:
      - field: "$.customer.email"
        type: email
        # john.doe@company.com → j***@c***.com

      - field: "$.customer.phone"
        type: phone
        # +1-555-123-4567 → +1-555-***-****

      - field: "$.customer.ssn"
        type: ssn
        # 123-45-6789 → ***-**-6789

      - field: "$.customer.name"
        type: name
        # John Doe → J*** D***

      - field: "$.payment.card_number"
        type: credit_card
        # 4111111111111111 → ************1111

      - field: "$.address"
        type: redact
        # Any value → [REDACTED]
```

### Masking Types

| Type | Description | Example |
|------|-------------|---------|
| `email` | Partial email masking | `j***@e***.com` |
| `phone` | Last 4 digits visible | `***-***-1234` |
| `ssn` | Last 4 digits visible | `***-**-6789` |
| `name` | First letter visible | `J*** D***` |
| `credit_card` | Last 4 digits visible | `************1111` |
| `redact` | Complete replacement | `[REDACTED]` |
| `hash` | Consistent hash | `a1b2c3d4...` |
| `random` | Random replacement | Random value |

### Custom Masking

```yaml
enterprise:
  masking:
    rules:
      - field: "$.custom_id"
        type: custom
        pattern: "XXX-{last:4}"  # Show last 4

      - field: "$.internal_code"
        type: custom
        pattern: "{first:2}***{last:2}"  # Show first 2 and last 2
```

## Kubernetes Configuration

### Secrets for Encryption Keys

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: encryption-key
  namespace: kafka-backup
type: Opaque
stringData:
  key: "your-32-byte-encryption-key-here"
```

### Operator Configuration

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: encrypted-backup
spec:
  enterprise:
    licenseSecret:
      name: kafka-backup-license
      key: license.key

    encryption:
      enabled: true
      keySecret:
        name: encryption-key
        key: key
      fields:
        - "$.customer.ssn"
        - "$.customer.email"
```

## Verification

### Verify Encryption

```bash
# Check backup metadata
kafka-backup describe \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --format json | jq '.encryption'
```

Output:

```json
{
  "enabled": true,
  "algorithm": "AES-256-GCM",
  "encrypted_fields": [
    "$.customer.ssn",
    "$.customer.email"
  ],
  "key_provider": "aws-kms",
  "key_id": "arn:aws:kms:..."
}
```

### Sample Encrypted Data

```bash
# View sample records from backup (shows encrypted fields)
kafka-backup sample \
  --path s3://bucket/backups \
  --backup-id my-backup \
  --topic orders \
  --count 5
```

## Performance Impact

| Operation | Without Encryption | With Encryption | Overhead |
|-----------|-------------------|-----------------|----------|
| Backup | 100 MB/s | 90 MB/s | ~10% |
| Restore (decrypt) | 150 MB/s | 120 MB/s | ~20% |
| Restore (no decrypt) | 150 MB/s | 148 MB/s | ~1% |

For best performance:
- Use hardware AES acceleration (available on most modern CPUs)
- Limit encryption to truly sensitive fields
- Use KMS with local caching

## Best Practices

1. **Encrypt only what's needed** - Don't encrypt everything
2. **Use KMS** - Better key management than static keys
3. **Document encrypted fields** - Know what's protected
4. **Test restore** - Verify decryption works
5. **Key backup** - Ensure keys are recoverable
6. **Audit access** - Log encryption/decryption operations

## Troubleshooting

### Decryption Failed

```
Error: Failed to decrypt field $.customer.ssn
```

**Causes:**
- Wrong key
- Key rotated without old key available
- Corrupted data

**Solution:**

```yaml
# Add old keys for rotation
enterprise:
  encryption:
    key_provider: env
    key_env_var: CURRENT_KEY
    old_keys:
      - env_var: OLD_KEY_V1
      - env_var: OLD_KEY_V2
```

### KMS Access Denied

```
Error: Access denied to KMS key
```

**Solution:** Check IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:region:account:key/key-id"
    }
  ]
}
```

## Next Steps

- [RBAC Configuration](./rbac) - Control access to encryption keys
- [Audit Logging](./audit-logging) - Log encryption operations
- [Compliance Guide](../use-cases/compliance-audit) - Compliance requirements
