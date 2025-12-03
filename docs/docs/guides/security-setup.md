---
title: Security Setup
description: Configure TLS, SASL, and encryption for OSO Kafka Backup
sidebar_position: 5
---

# Security Setup

Secure your Kafka backup operations with TLS encryption and SASL authentication.

## Security Overview

OSO Kafka Backup supports multiple security configurations:

| Feature | Description |
|---------|-------------|
| **TLS/SSL** | Encrypt data in transit |
| **SASL** | Authenticate to Kafka |
| **mTLS** | Mutual TLS authentication |
| **Storage Encryption** | Encrypt data at rest |

## TLS Configuration

### TLS Only (Encryption)

Encrypt communication without authentication:

```yaml
source:
  bootstrap_servers:
    - kafka:9093
  security:
    security_protocol: SSL
    ssl_ca_location: /certs/ca.crt
```

### TLS with Client Certificate (mTLS)

Mutual TLS for encryption and authentication:

```yaml
source:
  bootstrap_servers:
    - kafka:9093
  security:
    security_protocol: SSL
    ssl_ca_location: /certs/ca.crt
    ssl_certificate_location: /certs/client.crt
    ssl_key_location: /certs/client.key
    ssl_key_password: ${SSL_KEY_PASSWORD}  # If key is encrypted
```

### Certificate Requirements

| File | Purpose | Format |
|------|---------|--------|
| `ca.crt` | CA certificate to verify broker | PEM |
| `client.crt` | Client certificate | PEM |
| `client.key` | Client private key | PEM (PKCS#8) |

### Creating Certificates

Using OpenSSL:

```bash
# Generate CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 365 -key ca.key -out ca.crt \
  -subj "/CN=Kafka-CA"

# Generate client key and CSR
openssl genrsa -out client.key 4096
openssl req -new -key client.key -out client.csr \
  -subj "/CN=kafka-backup"

# Sign client certificate
openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out client.crt
```

## SASL Configuration

### SASL/PLAIN

Simple username/password authentication:

```yaml
source:
  bootstrap_servers:
    - kafka:9092
  security:
    security_protocol: SASL_PLAINTEXT  # Or SASL_SSL
    sasl_mechanism: PLAIN
    sasl_username: backup-user
    sasl_password: ${KAFKA_PASSWORD}
```

### SASL/SCRAM-SHA-256

More secure password authentication:

```yaml
source:
  bootstrap_servers:
    - kafka:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-256
    sasl_username: backup-user
    sasl_password: ${KAFKA_PASSWORD}
    ssl_ca_location: /certs/ca.crt
```

### SASL/SCRAM-SHA-512

Strongest SCRAM variant:

```yaml
source:
  bootstrap_servers:
    - kafka:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-512
    sasl_username: backup-user
    sasl_password: ${KAFKA_PASSWORD}
    ssl_ca_location: /certs/ca.crt
```

## Security Protocol Matrix

| Protocol | Encryption | Authentication |
|----------|------------|----------------|
| `PLAINTEXT` | No | No |
| `SSL` | Yes (TLS) | Optional (mTLS) |
| `SASL_PLAINTEXT` | No | Yes (SASL) |
| `SASL_SSL` | Yes (TLS) | Yes (SASL) |

## Kubernetes Secret Management

### Create Secrets

```yaml title="kafka-credentials.yaml"
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

```yaml title="kafka-tls.yaml"
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

### Use in Deployment

```yaml
spec:
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
      volumeMounts:
        - name: tls
          mountPath: /certs
          readOnly: true
  volumes:
    - name: tls
      secret:
        secretName: kafka-tls
```

### Kubernetes Operator Configuration

The operator handles secrets automatically:

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: secure-backup
spec:
  kafkaCluster:
    bootstrapServers:
      - kafka:9093
    securityProtocol: SASL_SSL
    tlsSecret:
      name: kafka-tls
      caKey: ca.crt
    saslSecret:
      name: kafka-credentials
      mechanism: SCRAM-SHA-256
      usernameKey: username
      passwordKey: password
```

## Storage Encryption

### S3 Server-Side Encryption

```yaml
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  # S3 encrypts at rest automatically with SSE-S3
  # Or configure SSE-KMS in bucket settings
```

Enable in bucket:

```bash
aws s3api put-bucket-encryption \
  --bucket my-kafka-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:us-west-2:123456789:key/12345"
      }
    }]
  }'
```

### Azure Encryption

Azure encrypts all data at rest by default. For customer-managed keys:

```bash
az storage account update \
  --name mystorageaccount \
  --resource-group mygroup \
  --encryption-key-source Microsoft.Keyvault \
  --encryption-key-vault https://myvault.vault.azure.net \
  --encryption-key-name mykey
```

### GCS Encryption

GCS encrypts all data at rest by default. For customer-managed keys:

```bash
gcloud storage buckets update gs://my-bucket \
  --default-encryption-key=projects/PROJECT_ID/locations/LOCATION/keyRings/KEY_RING/cryptoKeys/KEY
```

## ACL Requirements

### Minimum Kafka ACLs for Backup

```bash
# Allow reading from all topics
kafka-acls --bootstrap-server kafka:9092 \
  --add --allow-principal User:backup-user \
  --operation Read --operation Describe \
  --topic '*'

# Allow reading consumer group offsets
kafka-acls --bootstrap-server kafka:9092 \
  --add --allow-principal User:backup-user \
  --operation Read --operation Describe \
  --group '*'

# Optional: Cluster describe for metadata
kafka-acls --bootstrap-server kafka:9092 \
  --add --allow-principal User:backup-user \
  --operation Describe \
  --cluster
```

### Minimum Kafka ACLs for Restore

```bash
# Allow writing to topics
kafka-acls --bootstrap-server kafka:9092 \
  --add --allow-principal User:restore-user \
  --operation Write --operation Create --operation Describe \
  --topic '*'

# For offset reset
kafka-acls --bootstrap-server kafka:9092 \
  --add --allow-principal User:restore-user \
  --operation Read --operation Write \
  --group '*'
```

## Environment Variables

Secure credentials using environment variables:

```bash
export KAFKA_PASSWORD="your-password"
export SSL_KEY_PASSWORD="key-password"
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
```

Reference in config:

```yaml
source:
  security:
    sasl_password: ${KAFKA_PASSWORD}
    ssl_key_password: ${SSL_KEY_PASSWORD}

storage:
  backend: s3
  access_key: ${AWS_ACCESS_KEY_ID}
  secret_key: ${AWS_SECRET_ACCESS_KEY}
```

## Best Practices

### Credential Management

1. **Never commit credentials** - Use secrets management
2. **Rotate credentials** - Regular rotation policy
3. **Least privilege** - Minimal required permissions
4. **Audit access** - Log and monitor credential usage

### Certificate Management

1. **Automate renewal** - Use cert-manager or similar
2. **Monitor expiry** - Alert before certificates expire
3. **Secure storage** - Protect private keys
4. **Use short-lived certs** - 90 days or less

### Network Security

1. **Use TLS** - Always encrypt in transit
2. **Private networks** - Keep Kafka on private subnets
3. **Firewall rules** - Restrict access to backup service
4. **VPC endpoints** - Use private connectivity to cloud storage

## Troubleshooting

### SSL Handshake Failed

```
Error: SSL handshake failed
```

**Causes:**
- Certificate mismatch
- Expired certificate
- Wrong CA certificate

**Solution:**

```bash
# Verify certificate
openssl s_client -connect kafka:9093 -CAfile ca.crt

# Check expiry
openssl x509 -in client.crt -noout -dates
```

### SASL Authentication Failed

```
Error: SASL authentication failed
```

**Causes:**
- Wrong username/password
- User not created in Kafka
- Wrong SASL mechanism

**Solution:**

```bash
# Test with kafka-console-consumer
kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --consumer.config client.properties \
  --topic test
```

### Permission Denied

```
Error: Not authorized to access topic
```

**Solution:** Check and update ACLs:

```bash
kafka-acls --bootstrap-server kafka:9092 \
  --list --principal User:backup-user
```

## Complete Secure Configuration Example

```yaml title="secure-backup.yaml"
mode: backup
backup_id: "secure-production-backup"

source:
  bootstrap_servers:
    - kafka-0.kafka.svc:9093
    - kafka-1.kafka.svc:9093
    - kafka-2.kafka.svc:9093
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: SCRAM-SHA-512
    sasl_username: backup-service
    sasl_password: ${KAFKA_PASSWORD}
    ssl_ca_location: /certs/ca.crt
    ssl_certificate_location: /certs/client.crt
    ssl_key_location: /certs/client.key
  topics:
    include:
      - "*"
    exclude:
      - "__consumer_offsets"

storage:
  backend: s3
  bucket: secure-kafka-backups
  region: us-west-2
  # Uses IAM role - no static credentials

backup:
  compression: zstd
  compression_level: 3
  include_offset_headers: true
```

## Next Steps

- [Deployment Guide](../deployment) - Production deployment
- [Kubernetes Operator](../operator) - Secure K8s setup
- [Enterprise Features](../enterprise) - Field-level encryption
