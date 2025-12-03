---
title: Azure Blob Storage Setup
description: Configure Azure Blob Storage as backend for OSO Kafka Backup
sidebar_position: 2
---

# Azure Blob Storage Setup

Configure Azure Blob Storage for Kafka backups.

## Prerequisites

- Azure subscription
- Azure CLI installed
- Permissions to create storage accounts

## Create Storage Account

### Using Azure CLI

```bash
# Set variables
RESOURCE_GROUP="kafka-backup-rg"
STORAGE_ACCOUNT="kafkabackups$(date +%s)"  # Must be globally unique
LOCATION="westus2"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

# Create container
az storage container create \
  --name kafka-backups \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login
```

### Using Terraform

```hcl title="azure-storage.tf"
resource "azurerm_resource_group" "kafka_backup" {
  name     = "kafka-backup-rg"
  location = "West US 2"
}

resource "azurerm_storage_account" "kafka_backup" {
  name                     = "kafkabackups${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.kafka_backup.name
  location                 = azurerm_resource_group.kafka_backup.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }
  }
}

resource "azurerm_storage_container" "kafka_backups" {
  name                  = "kafka-backups"
  storage_account_name  = azurerm_storage_account.kafka_backup.name
  container_access_type = "private"
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}
```

## Authentication Methods

### Storage Account Key

```bash
# Get storage account key
az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "[0].value" -o tsv
```

### Connection String

```bash
# Get connection string
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv
```

### Managed Identity (Azure VMs/AKS)

```bash
# Enable system-assigned managed identity on VM
az vm identity assign \
  --resource-group $RESOURCE_GROUP \
  --name my-vm

# Get principal ID
PRINCIPAL_ID=$(az vm show \
  --resource-group $RESOURCE_GROUP \
  --name my-vm \
  --query identity.principalId -o tsv)

# Assign Storage Blob Data Contributor role
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee $PRINCIPAL_ID \
  --scope "/subscriptions/<sub-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT"
```

### Service Principal

```bash
# Create service principal
az ad sp create-for-rbac \
  --name kafka-backup-sp \
  --role "Storage Blob Data Contributor" \
  --scopes "/subscriptions/<sub-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT"
```

## Configuration

### With Storage Account Key

```yaml title="backup.yaml"
storage:
  backend: azure
  container: kafka-backups
  account_name: kafkabackups123456
  account_key: ${AZURE_STORAGE_KEY}
  prefix: production/daily
```

### With Connection String

```yaml title="backup.yaml"
storage:
  backend: azure
  container: kafka-backups
  connection_string: ${AZURE_STORAGE_CONNECTION_STRING}
  prefix: production/daily
```

### With Managed Identity

```yaml title="backup.yaml"
storage:
  backend: azure
  container: kafka-backups
  account_name: kafkabackups123456
  # No credentials needed - uses managed identity
  prefix: production/daily
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_STORAGE_ACCOUNT` | Storage account name |
| `AZURE_STORAGE_KEY` | Storage account key |
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string |
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_CLIENT_SECRET` | Service principal secret |
| `AZURE_TENANT_ID` | Azure AD tenant ID |

## AKS Workload Identity

For AKS, use workload identity:

```bash
# Enable workload identity on cluster
az aks update \
  --resource-group $RESOURCE_GROUP \
  --name my-aks-cluster \
  --enable-oidc-issuer \
  --enable-workload-identity

# Create managed identity
az identity create \
  --name kafka-backup-identity \
  --resource-group $RESOURCE_GROUP

# Get identity client ID
CLIENT_ID=$(az identity show \
  --name kafka-backup-identity \
  --resource-group $RESOURCE_GROUP \
  --query clientId -o tsv)

# Assign role
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee $CLIENT_ID \
  --scope "/subscriptions/<sub-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT"

# Create federated credential
az identity federated-credential create \
  --name kafka-backup-federated \
  --identity-name kafka-backup-identity \
  --resource-group $RESOURCE_GROUP \
  --issuer $(az aks show --name my-aks-cluster --resource-group $RESOURCE_GROUP --query oidcIssuerProfile.issuerUrl -o tsv) \
  --subject system:serviceaccount:kafka-backup:kafka-backup \
  --audience api://AzureADTokenExchange
```

Kubernetes ServiceAccount:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kafka-backup
  namespace: kafka-backup
  annotations:
    azure.workload.identity/client-id: <client-id>
  labels:
    azure.workload.identity/use: "true"
```

## Lifecycle Management

### Set Up Lifecycle Policy

```bash
# Create lifecycle policy JSON
cat > lifecycle-policy.json << 'EOF'
{
  "rules": [
    {
      "enabled": true,
      "name": "archive-old-backups",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": {
              "daysAfterModificationGreaterThan": 30
            },
            "tierToArchive": {
              "daysAfterModificationGreaterThan": 90
            },
            "delete": {
              "daysAfterModificationGreaterThan": 365
            }
          }
        },
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["kafka-backups/production/"]
        }
      }
    }
  ]
}
EOF

# Apply policy
az storage account management-policy create \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --policy @lifecycle-policy.json
```

## Access Tiers

| Tier | Use Case | Access Time | Cost |
|------|----------|-------------|------|
| Hot | Frequent access | Instant | $$$ |
| Cool | Infrequent (30+ days) | Instant | $$ |
| Archive | Rare access (180+ days) | Hours | $ |

## Geo-Replication

For disaster recovery:

```bash
# Create storage account with geo-redundancy
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_GRS \
  --kind StorageV2
```

Redundancy options:

| SKU | Description |
|-----|-------------|
| `Standard_LRS` | Locally redundant |
| `Standard_ZRS` | Zone redundant |
| `Standard_GRS` | Geo-redundant |
| `Standard_RAGRS` | Read-access geo-redundant |

## Security Best Practices

### Enable Encryption

```bash
# Enable infrastructure encryption
az storage account update \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --require-infrastructure-encryption
```

### Configure Firewall

```bash
# Restrict to specific VNet
az storage account network-rule add \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --vnet-name my-vnet \
  --subnet my-subnet

# Set default action to deny
az storage account update \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --default-action Deny
```

### Enable Soft Delete

```bash
az storage blob service-properties delete-policy update \
  --account-name $STORAGE_ACCOUNT \
  --enable true \
  --days-retained 30
```

## Testing

### Verify Access

```bash
# Test with Azure CLI
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name kafka-backups \
  --auth-mode login

# Test write
echo "test" | az storage blob upload \
  --account-name $STORAGE_ACCOUNT \
  --container-name kafka-backups \
  --name test.txt \
  --data @- \
  --auth-mode login

# Clean up
az storage blob delete \
  --account-name $STORAGE_ACCOUNT \
  --container-name kafka-backups \
  --name test.txt \
  --auth-mode login
```

### Test from Application

```bash
# Run backup
kafka-backup backup --config backup.yaml

# List backups
kafka-backup list --path azure://$STORAGE_ACCOUNT/kafka-backups/production/daily
```

## Troubleshooting

### Authentication Errors

```bash
# Check credentials
az storage account keys list --account-name $STORAGE_ACCOUNT

# Test with connection string
az storage container list --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
```

### Network Errors

```bash
# Check firewall rules
az storage account network-rule list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP

# Test connectivity
curl -v https://$STORAGE_ACCOUNT.blob.core.windows.net/
```

## Next Steps

- [Configuration Reference](../../reference/config-yaml) - All storage options
- [Backup Guide](../../guides/backup-to-s3) - Backup walkthrough
- [Security Setup](../../guides/security-setup) - Security configuration
