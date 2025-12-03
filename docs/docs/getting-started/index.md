---
title: Getting Started
description: Get started with OSO Kafka Backup - installation, CLI basics, and your first backup
sidebar_position: 1
---

# Getting Started with OSO Kafka Backup

Welcome to OSO Kafka Backup! This section will help you get up and running quickly.

## Overview

OSO Kafka Backup is a high-performance backup and restore tool for Apache Kafka. It supports:

- **Multiple storage backends**: S3, Azure Blob, GCS, and local filesystem
- **Point-in-time recovery (PITR)**: Restore to any millisecond within your backup window
- **Zero downtime**: No need to stop brokers or consumers
- **High throughput**: 100+ MB/s per partition
- **Compression**: Zstd (default), LZ4, or no compression

## Learning Path

### 1. Quick Start (5 minutes)

If you want to see Kafka Backup in action immediately:

→ [**5-Minute Quickstart**](./quickstart) - Run your first backup with Docker

### 2. Understand the CLI

Learn the command-line interface and available commands:

→ [**CLI Basics**](./cli-basics) - Commands, flags, and options

### 3. Your First Production Backup

Follow a detailed walkthrough of backing up and restoring a Kafka topic:

→ [**First Backup Tutorial**](./first-backup) - Step-by-step guide

## Prerequisites

Before you begin, ensure you have:

- **Kafka cluster**: Apache Kafka 2.0+, Confluent Platform, or Amazon MSK
- **Storage**: S3 bucket, Azure container, GCS bucket, or local disk space
- **Credentials**: Kafka connection details and cloud storage credentials

## Installation Methods

OSO Kafka Backup can be installed in several ways:

| Method | Best For | Guide |
|--------|----------|-------|
| **Binary** | Bare metal servers, local development | [Bare Metal](../deployment/bare-metal) |
| **Docker** | Containerized environments, quick testing | [Docker](../deployment/docker) |
| **Kubernetes** | Production K8s clusters, GitOps workflows | [Kubernetes](../deployment/kubernetes) |
| **Helm** | K8s with operator-based management | [Operator Install](../operator/installation) |

## Quick Installation

### macOS / Linux

```bash
# Download the latest release
curl -L https://github.com/osodevops/kafka-backup/releases/latest/download/kafka-backup-linux-amd64.tar.gz | tar xz

# Move to PATH
sudo mv kafka-backup /usr/local/bin/

# Verify installation
kafka-backup --help
```

### Docker

```bash
# Pull the image
docker pull ghcr.io/osodevops/kafka-backup:latest

# Verify
docker run --rm ghcr.io/osodevops/kafka-backup:latest --help
```

### Kubernetes Operator

```bash
# Add the Helm repository
helm repo add oso https://osodevops.github.io/kafka-backup

# Install the operator
helm install kafka-backup-operator oso/kafka-backup-operator \
  -n kafka-backup-operator \
  --create-namespace
```

## What's Next?

1. **[Quickstart](./quickstart)** - Run your first backup in 5 minutes
2. **[CLI Basics](./cli-basics)** - Learn all available commands
3. **[First Backup](./first-backup)** - Detailed backup tutorial
4. **[Deployment Guide](../deployment)** - Production deployment options
