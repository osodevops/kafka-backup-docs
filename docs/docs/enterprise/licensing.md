---
title: Licensing
description: OSO Kafka Backup Enterprise licensing and activation
sidebar_position: 6
---

# Licensing

OSO Kafka Backup Enterprise requires a valid license for enterprise features.

## License Types

| License Type | Duration | Features | Support |
|--------------|----------|----------|---------|
| **Trial** | 30 days | All enterprise | Community |
| **Standard** | Annual | All enterprise | Business hours |
| **Premium** | Annual | All enterprise | 24/7 |
| **Site License** | Annual | Unlimited nodes | 24/7 + dedicated |

## Obtaining a License

### Request Trial License

```bash
# Request via CLI
kafka-backup license request \
  --email your@company.com \
  --company "Your Company" \
  --use-case "Evaluation for disaster recovery"

# You'll receive license via email
```

Or visit: https://oso.sh/kafka-backup/trial

### Purchase License

Contact sales:
- Email: sales@oso.sh
- Web: https://oso.sh/kafka-backup/pricing

## License Activation

### CLI Activation

```bash
# Apply license from file
kafka-backup license apply --file license.key

# Apply license from string
kafka-backup license apply --key "LICENSE_KEY_STRING"

# Verify activation
kafka-backup license info
```

### Configuration File

```yaml
enterprise:
  license:
    # Option 1: License key directly
    key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."

    # Option 2: License file path
    file: /etc/kafka-backup/license.key

    # Option 3: Environment variable
    key_env: KAFKA_BACKUP_LICENSE
```

### Environment Variable

```bash
export KAFKA_BACKUP_LICENSE="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."

# Or from file
export KAFKA_BACKUP_LICENSE=$(cat license.key)
```

## Kubernetes Installation

### Create License Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-backup-license
  namespace: kafka-backup
type: Opaque
stringData:
  license.key: |
    eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...
```

### Reference in Operator

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

### Helm Values

```yaml
# values.yaml
enterprise:
  enabled: true
  license:
    secretName: kafka-backup-license
    secretKey: license.key

# Or inline (not recommended for production)
enterprise:
  enabled: true
  license:
    key: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
```

## License Information

### View License Details

```bash
kafka-backup license info
```

Output:

```
License Information
==================
Type:        Enterprise
Customer:    Your Company
Contact:     admin@company.com

Features:
  ✓ Field-level encryption
  ✓ Data masking
  ✓ RBAC
  ✓ Audit logging
  ✓ Schema Registry sync
  ✓ WebAssembly plugins

Limits:
  Nodes:     Unlimited
  Topics:    Unlimited
  Storage:   Unlimited

Validity:
  Issued:    2024-01-01
  Expires:   2024-12-31
  Status:    Valid (335 days remaining)

Support:
  Level:     Premium
  Contact:   support@oso.sh
```

### Check Specific Feature

```bash
kafka-backup license check encryption
# Output: Feature 'encryption' is enabled

kafka-backup license check schema-registry
# Output: Feature 'schema-registry' is enabled
```

## License Limits

### Node-Based Licensing

Some licenses limit the number of nodes:

```bash
kafka-backup license info --nodes
```

Output:

```
Node Usage
==========
Licensed:  10 nodes
Active:    7 nodes
Available: 3 nodes

Active Nodes:
  - kafka-backup-pod-1 (since 2024-11-01)
  - kafka-backup-pod-2 (since 2024-11-01)
  - ...
```

### Feature-Based Licensing

```yaml
# License may include specific features
features:
  encryption: true
  masking: true
  rbac: true
  audit: true
  schema_registry: false  # Not included
  plugins: false          # Not included
```

## License Expiration

### Warning Notifications

```
# 30 days before expiration
[WARN] License expires in 30 days. Contact sales@oso.sh for renewal.

# 7 days before expiration
[WARN] License expires in 7 days! Enterprise features will be disabled.

# On expiration
[ERROR] License expired. Enterprise features disabled.
```

### Grace Period

After expiration:

| Days Expired | Behavior |
|--------------|----------|
| 0-7 days | Warning, features work |
| 8-14 days | Features disabled, backups continue |
| 15+ days | All operations require license |

### Renewal

```bash
# Apply renewed license
kafka-backup license apply --file renewed-license.key

# Verify
kafka-backup license info
```

## Offline Activation

For air-gapped environments:

### Generate Activation Request

```bash
# Generate request file
kafka-backup license activate-offline --output request.json

# Send request.json to licensing@oso.sh
# Receive activation.json in response
```

### Apply Offline Activation

```bash
kafka-backup license apply-offline --file activation.json
```

## License Validation

### Online Validation

Default behavior - validates with license server:

```yaml
enterprise:
  license:
    key: "..."
    validation:
      mode: online
      interval: 24h  # Check every 24 hours
```

### Offline Validation

For air-gapped environments:

```yaml
enterprise:
  license:
    key: "..."
    validation:
      mode: offline
      # License is cryptographically verified locally
```

### Cached Validation

Hybrid approach:

```yaml
enterprise:
  license:
    key: "..."
    validation:
      mode: cached
      online_interval: 7d   # Check online weekly
      offline_grace: 30d    # Allow offline for 30 days
```

## Troubleshooting

### Invalid License

```
Error: Invalid license
Reason: Signature verification failed
```

**Solutions:**
1. Check license wasn't modified
2. Ensure complete license key (no truncation)
3. Request new license

### License Expired

```
Error: License expired
Expired: 2024-06-01
```

**Solutions:**
1. Contact sales for renewal
2. Apply renewed license
3. Downgrade to open source features

### Node Limit Exceeded

```
Error: Node limit exceeded
Licensed: 10
Active: 11
```

**Solutions:**
1. Reduce active nodes
2. Upgrade license
3. Contact sales for temporary increase

### Feature Not Licensed

```
Error: Feature 'schema-registry' not included in license
```

**Solutions:**
1. Upgrade license to include feature
2. Use alternative approach (manual schema backup)

## License Commands Reference

```bash
# Request trial
kafka-backup license request --email user@company.com

# Apply license
kafka-backup license apply --file license.key
kafka-backup license apply --key "LICENSE_STRING"

# View license info
kafka-backup license info
kafka-backup license info --json
kafka-backup license info --features
kafka-backup license info --nodes

# Check specific feature
kafka-backup license check <feature>

# Validate license
kafka-backup license validate

# Offline activation
kafka-backup license activate-offline --output request.json
kafka-backup license apply-offline --file activation.json

# Remove license
kafka-backup license remove
```

## License Terms

### Permitted Use

- Production and non-production environments
- Backup and restore of your Kafka clusters
- Number of nodes as per license

### Restrictions

- No redistribution of software
- No reverse engineering
- No removal of license checks

### Audit Rights

Licensor may audit compliance with reasonable notice.

## Contact

- **Sales:** sales@oso.sh
- **Licensing:** licensing@oso.sh
- **Support:** support@oso.sh
- **Web:** https://oso.sh/kafka-backup

## Next Steps

- [Enterprise Overview](./) - All enterprise features
- [Installation](../deployment) - Deploy with license
- [Support](../troubleshooting/support) - Get help
