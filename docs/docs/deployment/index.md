---
title: Deployment Overview
description: Deploy OSO Kafka Backup on bare metal, Docker, or Kubernetes
sidebar_position: 1
---

# Deployment Overview

OSO Kafka Backup can be deployed in several ways depending on your infrastructure and requirements.

## Deployment Options

| Method | Best For | Management | Scalability |
|--------|----------|------------|-------------|
| **[Bare Metal](./bare-metal)** | Traditional servers, VMs | Manual | Manual |
| **[Docker](./docker)** | Containerized environments | Manual/Compose | Manual |
| **[Kubernetes](./kubernetes)** | K8s clusters (manual) | kubectl/Helm | Manual |
| **[Kubernetes Operator](../operator)** | Production K8s | CRDs/GitOps | Automatic |

## Quick Decision Guide

### Use Bare Metal When

- Running on traditional servers or VMs
- Simple single-node deployments
- Direct filesystem access required
- Minimal container overhead desired

### Use Docker When

- Local development and testing
- CI/CD pipelines
- Simple container deployments
- Docker Compose environments

### Use Kubernetes When

- Running on Kubernetes clusters
- Need manual control over backup scheduling
- Using external job schedulers (Argo, Airflow)
- Not ready for operator pattern

### Use Kubernetes Operator When

- Production Kubernetes deployments
- GitOps workflows (ArgoCD, Flux)
- Automated scheduled backups
- Multi-tenant environments
- Need declarative backup management

## System Requirements

### Minimum Requirements

| Resource | Requirement |
|----------|-------------|
| CPU | 1 core |
| Memory | 256 MB |
| Disk | 10 GB (+ backup storage) |
| Network | Access to Kafka brokers |

### Recommended for Production

| Resource | Requirement |
|----------|-------------|
| CPU | 2-4 cores |
| Memory | 1-2 GB |
| Disk | 100 GB SSD (for local storage) |
| Network | 1 Gbps to Kafka and storage |

### Sizing Guidelines

| Kafka Cluster Size | CPU | Memory | Notes |
|-------------------|-----|--------|-------|
| Small (< 100 partitions) | 1 core | 512 MB | Single instance |
| Medium (100-500 partitions) | 2 cores | 1 GB | Increase parallelism |
| Large (500+ partitions) | 4 cores | 2 GB | Consider multiple instances |

## Network Requirements

### Outbound Connections

| Service | Port | Protocol | Required |
|---------|------|----------|----------|
| Kafka Brokers | 9092 (or custom) | TCP | Yes |
| AWS S3 | 443 | HTTPS | If using S3 |
| Azure Blob | 443 | HTTPS | If using Azure |
| GCS | 443 | HTTPS | If using GCS |

### Security Considerations

- Use TLS for Kafka connections in production
- Use IAM roles/service accounts for cloud storage (avoid static credentials)
- Restrict network access to backup service
- Encrypt data at rest in storage backend

## Storage Backend Setup

Before deploying, configure your storage backend:

| Backend | Setup Guide |
|---------|-------------|
| AWS S3 | [AWS S3 Setup](./cloud-setup/aws-s3) |
| Azure Blob | [Azure Blob Setup](./cloud-setup/azure-blob) |
| Google Cloud Storage | [GCS Setup](./cloud-setup/gcs) |

## Next Steps

1. Choose your deployment method:
   - [Bare Metal Installation](./bare-metal)
   - [Docker Deployment](./docker)
   - [Kubernetes Deployment](./kubernetes)

2. Configure cloud storage (if applicable):
   - [AWS S3](./cloud-setup/aws-s3)
   - [Azure Blob](./cloud-setup/azure-blob)
   - [GCS](./cloud-setup/gcs)

3. For production Kubernetes:
   - [Kubernetes Operator](../operator)
