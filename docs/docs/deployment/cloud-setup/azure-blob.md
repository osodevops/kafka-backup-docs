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

OSO Kafka Backup v0.2.1+ supports multiple Azure authentication methods with automatic detection.

### Authentication Methods

| Method | Use Case | Required Fields |
|--------|----------|-----------------|
| Account Key | Development/testing | `account_key` |
| SAS Token | Time-limited access | `sas_token` |
| Service Principal | CI/CD pipelines | `client_id`, `tenant_id`, `client_secret` |
| Workload Identity | AKS with managed identity | `use_workload_identity: true` (or auto-detected) |
| DefaultAzureCredential | Fallback chain | No auth fields (uses Azure SDK default) |

### With Storage Account Key

```yaml title="backup.yaml"
storage:
  backend: azure
  account_name: kafkabackups123456
  container_name: kafka-backups
  account_key: ${AZURE_STORAGE_KEY}
  prefix: production/daily
```

### With SAS Token

```yaml title="backup.yaml"
storage:
  backend: azure
  account_name: kafkabackups123456
  container_name: kafka-backups
  sas_token: ${AZURE_SAS_TOKEN}
  prefix: production/daily
```

### With Service Principal

```yaml title="backup.yaml"
storage:
  backend: azure
  account_name: kafkabackups123456
  container_name: kafka-backups
  client_id: ${AZURE_CLIENT_ID}
  tenant_id: ${AZURE_TENANT_ID}
  client_secret: ${AZURE_CLIENT_SECRET}
  prefix: production/daily
```

### With Workload Identity (AKS)

```yaml title="backup.yaml"
storage:
  backend: azure
  account_name: kafkabackups123456
  container_name: kafka-backups
  use_workload_identity: true  # Or auto-detected via AZURE_FEDERATED_TOKEN_FILE
  prefix: production/daily
```

### With DefaultAzureCredential (Auto-detect)

```yaml title="backup.yaml"
storage:
  backend: azure
  account_name: kafkabackups123456
  container_name: kafka-backups
  # No credentials - uses Azure SDK's DefaultAzureCredential chain
  prefix: production/daily
```

### Custom Endpoint (Sovereign Clouds)

For Azure Government, China, or private endpoints:

```yaml title="backup.yaml"
storage:
  backend: azure
  account_name: kafkabackups123456
  container_name: kafka-backups
  endpoint: https://kafkabackups123456.blob.core.usgovcloudapi.net
  account_key: ${AZURE_STORAGE_KEY}
  prefix: production/daily
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_STORAGE_ACCOUNT` | Storage account name |
| `AZURE_STORAGE_KEY` | Storage account key |
| `AZURE_SAS_TOKEN` | SAS token for time-limited access |
| `AZURE_CLIENT_ID` | Service principal or managed identity client ID |
| `AZURE_CLIENT_SECRET` | Service principal secret |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_FEDERATED_TOKEN_FILE` | Auto-injected by Workload Identity webhook |
| `AZURE_AUTHORITY_HOST` | Azure AD authority (auto-injected) |

### Generate SAS Token

```bash
# Generate SAS token with 1-year expiry
END_DATE=$(date -u -d "+1 year" '+%Y-%m-%dT%H:%MZ')

az storage container generate-sas \
  --account-name $STORAGE_ACCOUNT \
  --name kafka-backups \
  --permissions rwdl \
  --expiry $END_DATE \
  --auth-mode login \
  --as-user \
  -o tsv
```

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

## Azure Key Vault Integration

Use Azure Key Vault with the CSI Secrets Store Driver to securely manage credentials for Kafka and storage access.

### Prerequisites

- AKS cluster with Workload Identity enabled
- Azure Key Vault created
- Azure CSI Secrets Store Driver installed

### Install CSI Secrets Store Driver

```bash
# Add the Helm repo
helm repo add csi-secrets-store-provider-azure \
  https://azure.github.io/secrets-store-csi-driver-provider-azure/charts
helm repo update

# Install the Azure provider
helm install csi-secrets-store-provider-azure \
  csi-secrets-store-provider-azure/csi-secrets-store-provider-azure \
  --namespace kube-system
```

### Grant Key Vault Access

```bash
# Get the managed identity principal ID
PRINCIPAL_ID=$(az identity show \
  --name kafka-backup-identity \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Grant secret access to Key Vault
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Store Secrets in Key Vault

```bash
# Store Kafka credentials
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name kafka-sasl-username \
  --value "<kafka-api-key>"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name kafka-sasl-password \
  --value "<kafka-api-secret>"

# Store storage account key (if not using Workload Identity for storage)
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name azure-storage-account-key \
  --value "<storage-account-key>"
```

### Create SecretProviderClass

The SecretProviderClass syncs secrets from Azure Key Vault to Kubernetes secrets:

```yaml title="secretproviderclass.yaml"
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: kafka-backup-secrets
  namespace: kafka-backup
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    clientID: <managed-identity-client-id>
    keyvaultName: <key-vault-name>
    tenantId: <azure-tenant-id>
    objects: |
      array:
        - |
          objectName: kafka-sasl-username
          objectType: secret
        - |
          objectName: kafka-sasl-password
          objectType: secret
        - |
          objectName: azure-storage-account-key
          objectType: secret
  secretObjects:
    - secretName: kafka-backup-secrets
      type: Opaque
      data:
        - objectName: kafka-sasl-username
          key: KAFKA_SASL_USERNAME
        - objectName: kafka-sasl-password
          key: KAFKA_SASL_PASSWORD
        - objectName: azure-storage-account-key
          key: AZURE_STORAGE_KEY
```

### Using Secrets in Pods

Mount the CSI volume and reference the synced Kubernetes secret:

```yaml title="pod-with-secrets.yaml"
apiVersion: v1
kind: Pod
metadata:
  name: kafka-backup
  namespace: kafka-backup
  labels:
    azure.workload.identity/use: "true"
spec:
  serviceAccountName: kafka-backup
  containers:
    - name: kafka-backup
      image: ghcr.io/osodevops/kafka-backup:latest
      env:
        - name: KAFKA_SASL_USERNAME
          valueFrom:
            secretKeyRef:
              name: kafka-backup-secrets
              key: KAFKA_SASL_USERNAME
        - name: KAFKA_SASL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kafka-backup-secrets
              key: KAFKA_SASL_PASSWORD
        - name: AZURE_STORAGE_KEY
          valueFrom:
            secretKeyRef:
              name: kafka-backup-secrets
              key: AZURE_STORAGE_KEY
      volumeMounts:
        - name: secrets-store
          mountPath: /mnt/secrets-store
          readOnly: true
  volumes:
    - name: secrets-store
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: kafka-backup-secrets
```

### Helm Values for Key Vault Integration

When using the Kafka Backup Operator Helm chart, configure Key Vault integration:

```yaml title="values-azure-keyvault.yaml"
deployment:
  tenantId: <azure-tenant-id>
  workloadIdentityClientId: <managed-identity-client-id>
  serviceAccountName: kafka-backup
  syncSecrets:
    keyVaultName: <key-vault-name>
    envSecrets:
      kafka-sasl-username: KAFKA_SASL_USERNAME
      kafka-sasl-password: KAFKA_SASL_PASSWORD
      azure-storage-account-key: AZURE_STORAGE_KEY
```

This configuration:
- Uses Workload Identity for authentication (no stored credentials)
- Syncs secrets from Azure Key Vault to Kubernetes secrets
- Maps Key Vault secret names to environment variable names

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
