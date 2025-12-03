---
title: 5-Minute Quickstart
description: Get your first Kafka backup running in under 5 minutes using Docker
sidebar_position: 2
---

# 5-Minute Quickstart

This guide will have you backing up and restoring Kafka topics in under 5 minutes using Docker.

## Prerequisites

- Docker and Docker Compose installed
- A running Kafka cluster (we'll provide a test setup)

## Step 1: Start a Test Kafka Cluster

If you don't have a Kafka cluster, start one with Docker Compose:

```yaml title="docker-compose.yml"
version: '3.8'
services:
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    hostname: kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
```

```bash
docker-compose up -d
```

## Step 2: Create a Test Topic with Data

```bash
# Create a topic
docker exec -it kafka kafka-topics --create \
  --topic test-topic \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1

# Produce some test messages
docker exec -it kafka bash -c 'for i in {1..100}; do echo "message-$i"; done | kafka-console-producer --broker-list localhost:9092 --topic test-topic'

# Verify messages
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic test-topic \
  --from-beginning \
  --max-messages 5
```

## Step 3: Create Backup Configuration

Create a backup configuration file:

```yaml title="backup.yaml"
mode: backup
backup_id: "quickstart-backup"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - test-topic

storage:
  backend: filesystem
  path: "/data/backups"

backup:
  compression: zstd
  compression_level: 3
```

## Step 4: Run the Backup

```bash
# Create backup directory
mkdir -p ./backups

# Run the backup
docker run --rm \
  --network host \
  -v $(pwd)/backup.yaml:/config/backup.yaml \
  -v $(pwd)/backups:/data/backups \
  ghcr.io/osodevops/kafka-backup:latest \
  backup --config /config/backup.yaml
```

You should see output like:

```
[INFO] Starting backup: quickstart-backup
[INFO] Connected to Kafka cluster
[INFO] Backing up topic: test-topic (3 partitions)
[INFO] Partition 0: 34 records backed up
[INFO] Partition 1: 33 records backed up
[INFO] Partition 2: 33 records backed up
[INFO] Backup completed successfully
[INFO] Total: 100 records, 2.4 KB compressed
```

## Step 5: Verify the Backup

List the backup:

```bash
docker run --rm \
  -v $(pwd)/backups:/data/backups \
  ghcr.io/osodevops/kafka-backup:latest \
  list --path /data/backups
```

Output:

```
Available Backups:
  quickstart-backup
    Created: 2024-12-03T10:00:00Z
    Topics: 1
    Records: 100
    Size: 2.4 KB (compressed)
```

Get detailed backup info:

```bash
docker run --rm \
  -v $(pwd)/backups:/data/backups \
  ghcr.io/osodevops/kafka-backup:latest \
  describe --path /data/backups --backup-id quickstart-backup
```

## Step 6: Simulate Disaster (Delete the Topic)

```bash
# Delete the topic
docker exec -it kafka kafka-topics --delete \
  --topic test-topic \
  --bootstrap-server localhost:9092

# Verify it's gone
docker exec -it kafka kafka-topics --list \
  --bootstrap-server localhost:9092
```

## Step 7: Restore from Backup

Create a restore configuration:

```yaml title="restore.yaml"
mode: restore
backup_id: "quickstart-backup"

target:
  bootstrap_servers:
    - kafka:9092

storage:
  backend: filesystem
  path: "/data/backups"

restore:
  dry_run: false
```

Run the restore:

```bash
docker run --rm \
  --network host \
  -v $(pwd)/restore.yaml:/config/restore.yaml \
  -v $(pwd)/backups:/data/backups \
  ghcr.io/osodevops/kafka-backup:latest \
  restore --config /config/restore.yaml
```

## Step 8: Verify the Restore

```bash
# Check the topic exists
docker exec -it kafka kafka-topics --list \
  --bootstrap-server localhost:9092

# Verify the messages
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic test-topic \
  --from-beginning \
  --max-messages 5
```

You should see your original messages restored.

## What You've Learned

In this quickstart, you:

1. Created a Kafka topic with test data
2. Backed up the topic to local storage
3. Verified the backup contents
4. Simulated a disaster by deleting the topic
5. Restored the topic from backup
6. Verified the restored data

## Next Steps

- **[CLI Basics](./cli-basics)** - Learn all available commands
- **[First Backup Tutorial](./first-backup)** - More detailed walkthrough
- **[Backup to S3](../guides/backup-to-s3)** - Use cloud storage
- **[Point-in-Time Recovery](../guides/restore-pitr)** - Restore to specific timestamps
- **[Kubernetes Operator](../operator)** - Automated backups with CRDs

## Cleanup

```bash
# Stop and remove containers
docker-compose down -v

# Remove backup files
rm -rf ./backups
```
