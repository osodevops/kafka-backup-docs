---
title: RBAC
description: Role-based access control for OSO Kafka Backup Enterprise
sidebar_position: 3
---

# Role-Based Access Control (RBAC)

OSO Kafka Backup Enterprise provides fine-grained access control to backup and restore operations.

## Overview

RBAC allows you to:

- Control who can perform backup operations
- Control who can perform restore operations
- Restrict access to specific topics
- Limit access to specific storage locations
- Audit all access attempts

## Configuration

### Basic RBAC Setup

```yaml
enterprise:
  rbac:
    enabled: true

    # Authentication method
    auth:
      method: oidc
      issuer: https://auth.company.com
      client_id: kafka-backup
      audience: kafka-backup-api

    # Role definitions
    roles:
      - name: backup-admin
        permissions:
          - "*"

      - name: backup-operator
        permissions:
          - backup:*
          - list:*
          - describe:*
          - validate:*

      - name: restore-operator
        permissions:
          - restore:*
          - list:*
          - describe:*
          - validate:*

      - name: readonly
        permissions:
          - list:*
          - describe:*
```

## Authentication Methods

### OIDC (Recommended)

```yaml
enterprise:
  rbac:
    auth:
      method: oidc
      issuer: https://auth.company.com
      client_id: kafka-backup
      audience: kafka-backup-api
      scopes:
        - openid
        - profile
        - kafka-backup

      # Map OIDC claims to roles
      role_claim: roles
      # Or use groups
      # group_claim: groups
```

### LDAP

```yaml
enterprise:
  rbac:
    auth:
      method: ldap
      server: ldap://ldap.company.com:389
      bind_dn: cn=service,dc=company,dc=com
      bind_password: ${LDAP_PASSWORD}
      user_base: ou=users,dc=company,dc=com
      user_filter: "(uid={0})"
      group_base: ou=groups,dc=company,dc=com
      group_filter: "(member={0})"
```

### Static Users (Development)

```yaml
enterprise:
  rbac:
    auth:
      method: static
      users:
        - username: admin
          password_hash: "$2b$12$..."  # bcrypt hash
          roles:
            - backup-admin

        - username: operator
          password_hash: "$2b$12$..."
          roles:
            - backup-operator
```

### Kubernetes Service Accounts

```yaml
enterprise:
  rbac:
    auth:
      method: kubernetes
      # Uses Kubernetes RBAC
      # Roles mapped from ServiceAccount annotations
```

## Permission Model

### Permission Format

```
<operation>:<resource>:<scope>
```

Examples:
- `backup:*` - All backup operations
- `restore:topic:orders` - Restore only orders topic
- `list:*` - List all backups
- `describe:backup:*` - Describe any backup

### Available Operations

| Operation | Description |
|-----------|-------------|
| `backup` | Create backups |
| `restore` | Restore from backups |
| `list` | List backups |
| `describe` | View backup details |
| `validate` | Validate backups |
| `delete` | Delete backups |
| `config` | Modify configuration |
| `offset-reset` | Reset consumer offsets |

### Resource Types

| Resource | Description |
|----------|-------------|
| `*` | All resources |
| `topic:<name>` | Specific topic |
| `backup:<id>` | Specific backup |
| `storage:<path>` | Storage location |
| `group:<name>` | Consumer group |

### Scope Patterns

```yaml
# Exact match
- "restore:topic:orders"

# Wildcard
- "backup:topic:*"

# Pattern
- "restore:topic:orders-*"

# Multiple patterns
- "backup:topic:orders-*"
- "backup:topic:payments-*"
```

## Role Definitions

### Predefined Roles

```yaml
roles:
  # Full administrative access
  - name: admin
    permissions:
      - "*"

  # Can backup any topic
  - name: backup-operator
    permissions:
      - "backup:*"
      - "list:*"
      - "describe:*"
      - "validate:*"

  # Can restore any topic
  - name: restore-operator
    permissions:
      - "restore:*"
      - "list:*"
      - "describe:*"
      - "validate:*"
      - "offset-reset:*"

  # Read-only access
  - name: viewer
    permissions:
      - "list:*"
      - "describe:*"
```

### Custom Roles

```yaml
roles:
  # Team-specific role
  - name: orders-team
    permissions:
      - "backup:topic:orders"
      - "backup:topic:orders-*"
      - "restore:topic:orders"
      - "restore:topic:orders-*"
      - "list:*"
      - "describe:*"

  # Environment-specific role
  - name: prod-backup-only
    permissions:
      - "backup:storage:s3://prod-backups/*"
      - "list:storage:s3://prod-backups/*"
      - "describe:storage:s3://prod-backups/*"

  # Consumer offset management
  - name: offset-manager
    permissions:
      - "offset-reset:*"
      - "list:*"
      - "describe:*"
```

## Role Bindings

### User-Role Binding

```yaml
enterprise:
  rbac:
    bindings:
      - user: alice@company.com
        roles:
          - backup-admin

      - user: bob@company.com
        roles:
          - backup-operator
          - restore-operator

      - user: charlie@company.com
        roles:
          - viewer
```

### Group-Role Binding

```yaml
enterprise:
  rbac:
    bindings:
      - group: platform-team
        roles:
          - backup-admin

      - group: dev-team
        roles:
          - backup-operator

      - group: support-team
        roles:
          - viewer
```

### Service Account Binding

```yaml
enterprise:
  rbac:
    bindings:
      - serviceAccount: backup-cronjob
        namespace: kafka-backup
        roles:
          - backup-operator

      - serviceAccount: restore-service
        namespace: kafka-backup
        roles:
          - restore-operator
```

## Kubernetes Integration

### Using Kubernetes RBAC

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kafka-backup-operator
  namespace: kafka-backup
rules:
  - apiGroups: ["kafka.oso.sh"]
    resources: ["kafkabackups"]
    verbs: ["get", "list", "watch", "create", "update"]
  - apiGroups: ["kafka.oso.sh"]
    resources: ["kafkarestores"]
    verbs: ["get", "list", "watch"]  # No create - read only

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: backup-operator-binding
  namespace: kafka-backup
subjects:
  - kind: User
    name: alice@company.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: kafka-backup-operator
  apiGroup: rbac.authorization.k8s.io
```

### ServiceAccount Annotations

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backup-service
  namespace: kafka-backup
  annotations:
    kafka-backup.oso.sh/roles: "backup-operator,viewer"
```

## CLI Authentication

### Login

```bash
# OIDC login (opens browser)
kafka-backup auth login

# OIDC with device code (for headless)
kafka-backup auth login --device-code

# Username/password
kafka-backup auth login --username alice --password-stdin
```

### Token Management

```bash
# Show current user
kafka-backup auth whoami

# Output:
# User: alice@company.com
# Roles: backup-admin
# Expires: 2024-12-02T10:00:00Z

# Refresh token
kafka-backup auth refresh

# Logout
kafka-backup auth logout
```

### Service Account Token

```bash
# Use service account token
export KAFKA_BACKUP_TOKEN="eyJ..."

# Or via config
kafka-backup --token-file /var/run/secrets/token backup ...
```

## Access Denied Handling

### Error Messages

```
Error: Access denied
Operation: restore
Resource: topic:production-orders
User: bob@company.com
Roles: backup-operator

Required permission: restore:topic:production-orders
User permissions:
  - backup:*
  - list:*
  - describe:*
```

### Audit Log Entry

```json
{
  "timestamp": "2024-12-01T10:00:00Z",
  "event": "access_denied",
  "user": "bob@company.com",
  "operation": "restore",
  "resource": "topic:production-orders",
  "required_permission": "restore:topic:production-orders",
  "user_roles": ["backup-operator"],
  "client_ip": "10.0.0.50"
}
```

## Policy Examples

### Environment Separation

```yaml
roles:
  - name: prod-admin
    permissions:
      - "*:storage:s3://prod-backups/*"

  - name: staging-admin
    permissions:
      - "*:storage:s3://staging-backups/*"

  - name: dev-admin
    permissions:
      - "*:storage:s3://dev-backups/*"

bindings:
  - group: prod-team
    roles: [prod-admin]

  - group: dev-team
    roles: [staging-admin, dev-admin]
```

### Topic-Based Access

```yaml
roles:
  - name: orders-team
    permissions:
      - "*:topic:orders*"
      - "list:*"
      - "describe:*"

  - name: payments-team
    permissions:
      - "*:topic:payments*"
      - "list:*"
      - "describe:*"

  - name: analytics-team
    permissions:
      - "backup:topic:analytics*"
      - "restore:topic:analytics*"
      - "list:*"
      - "describe:*"
```

### Least Privilege for Automation

```yaml
roles:
  # Automated hourly backup - minimal permissions
  - name: automated-backup
    permissions:
      - "backup:topic:*"
      - "list:backup:*"  # To check existing backups

  # Automated validation - read only
  - name: automated-validation
    permissions:
      - "validate:*"
      - "list:*"
      - "describe:*"

bindings:
  - serviceAccount: hourly-backup-job
    roles: [automated-backup]

  - serviceAccount: validation-job
    roles: [automated-validation]
```

## Troubleshooting

### Debug Mode

```bash
# Show detailed permission checks
kafka-backup --rbac-debug backup --config backup.yaml
```

### List Effective Permissions

```bash
kafka-backup auth permissions

# Output:
# User: alice@company.com
# Roles: backup-operator, viewer
#
# Effective Permissions:
#   backup:*
#   list:*
#   describe:*
#   validate:*
```

### Test Permission

```bash
kafka-backup auth can-i restore topic:orders

# Output:
# yes (via role: restore-operator)

kafka-backup auth can-i delete backup:my-backup

# Output:
# no (no matching permission)
```

## Best Practices

1. **Use groups over users** - Easier to manage
2. **Least privilege** - Grant minimum required permissions
3. **Separate environments** - Different roles per environment
4. **Regular audits** - Review role assignments
5. **Service accounts for automation** - Don't use personal credentials
6. **Document role purposes** - Clear descriptions

## Next Steps

- [Audit Logging](./audit-logging) - Log all access attempts
- [Security Setup](../guides/security-setup) - TLS and SASL configuration
- [Kubernetes Operator](../operator) - Kubernetes RBAC integration
