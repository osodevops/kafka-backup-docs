---
title: Docker Deployment
description: Deploy OSO Kafka Backup using Docker and Docker Compose
sidebar_position: 3
---

# Docker Deployment

Run OSO Kafka Backup in Docker containers for development, testing, or production use.

## Prerequisites

- Docker 20.10+
- Docker Compose (optional)
- Network access to Kafka brokers

## Quick Start

### Pull the Image

```bash
docker pull ghcr.io/osodevops/kafka-backup:latest
```

### Verify Installation

```bash
docker run --rm ghcr.io/osodevops/kafka-backup:latest --version
docker run --rm ghcr.io/osodevops/kafka-backup:latest --help
```

## Running a Backup

### With Local Storage

```bash
# Create backup directory
mkdir -p ./backups

# Create config file
cat > backup.yaml << 'EOF'
mode: backup
backup_id: "my-backup"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - my-topic

storage:
  backend: filesystem
  path: "/data/backups"

backup:
  compression: zstd
EOF

# Run backup
docker run --rm \
  --network host \
  -v $(pwd)/backup.yaml:/config/backup.yaml:ro \
  -v $(pwd)/backups:/data/backups \
  ghcr.io/osodevops/kafka-backup:latest \
  backup --config /config/backup.yaml
```

### With S3 Storage

```bash
docker run --rm \
  -e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
  -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
  -e AWS_REGION="us-west-2" \
  -v $(pwd)/backup.yaml:/config/backup.yaml:ro \
  ghcr.io/osodevops/kafka-backup:latest \
  backup --config /config/backup.yaml
```

## Running a Restore

```bash
docker run --rm \
  --network host \
  -v $(pwd)/restore.yaml:/config/restore.yaml:ro \
  -v $(pwd)/backups:/data/backups:ro \
  ghcr.io/osodevops/kafka-backup:latest \
  restore --config /config/restore.yaml
```

## Docker Compose

### Development Environment

Complete environment with Kafka and backup service:

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
    healthcheck:
      test: ["CMD", "kafka-topics", "--bootstrap-server", "localhost:9092", "--list"]
      interval: 10s
      timeout: 5s
      retries: 5

  kafka-backup:
    image: ghcr.io/osodevops/kafka-backup:latest
    depends_on:
      kafka:
        condition: service_healthy
    volumes:
      - ./config:/config:ro
      - ./backups:/data/backups
    command: ["backup", "--config", "/config/backup.yaml"]
    # For one-shot runs, use:
    # profiles: ["backup"]

volumes:
  backups:
```

### Production Setup

```yaml title="docker-compose.prod.yml"
version: '3.8'

services:
  kafka-backup:
    image: ghcr.io/osodevops/kafka-backup:latest
    restart: unless-stopped
    environment:
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
    volumes:
      - ./config:/config:ro
      - kafka-backup-data:/data
    networks:
      - kafka-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "kafka-backup", "--help"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

networks:
  kafka-network:
    external: true

volumes:
  kafka-backup-data:
```

## Scheduled Backups

### Using Docker Compose with Cron

Create a wrapper script:

```bash title="run-backup.sh"
#!/bin/bash
docker-compose -f docker-compose.yml run --rm kafka-backup \
  backup --config /config/backup.yaml
```

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/run-backup.sh >> /var/log/kafka-backup.log 2>&1
```

### Using Ofelia (Cron for Docker)

```yaml title="docker-compose.yml"
version: '3.8'

services:
  ofelia:
    image: mcuadros/ofelia:latest
    depends_on:
      - kafka-backup
    command: daemon --docker
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    labels:
      ofelia.job-run.kafka-backup.schedule: "0 2 * * *"
      ofelia.job-run.kafka-backup.container: "kafka-backup"

  kafka-backup:
    image: ghcr.io/osodevops/kafka-backup:latest
    container_name: kafka-backup
    volumes:
      - ./config:/config:ro
      - ./backups:/data/backups
    command: ["backup", "--config", "/config/backup.yaml"]
    labels:
      ofelia.enabled: "true"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 |
| `AWS_REGION` | AWS region |
| `AZURE_STORAGE_ACCOUNT` | Azure storage account |
| `AZURE_STORAGE_KEY` | Azure storage key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON |
| `RUST_LOG` | Logging level (info, debug, trace) |

## Volume Mounts

| Container Path | Purpose | Mode |
|----------------|---------|------|
| `/config` | Configuration files | Read-only |
| `/data/backups` | Backup storage | Read-write |
| `/certs` | TLS certificates | Read-only |

## Security Considerations

### Run as Non-Root

The image runs as non-root by default (UID 1000):

```yaml
services:
  kafka-backup:
    image: ghcr.io/osodevops/kafka-backup:latest
    user: "1000:1000"
```

### Read-Only Root Filesystem

```yaml
services:
  kafka-backup:
    image: ghcr.io/osodevops/kafka-backup:latest
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - ./backups:/data/backups
```

### Secrets Management

Use Docker secrets for sensitive data:

```yaml
services:
  kafka-backup:
    image: ghcr.io/osodevops/kafka-backup:latest
    secrets:
      - kafka_password
      - aws_credentials
    environment:
      - KAFKA_PASSWORD_FILE=/run/secrets/kafka_password

secrets:
  kafka_password:
    file: ./secrets/kafka_password.txt
  aws_credentials:
    file: ./secrets/aws_credentials
```

## Multi-Architecture Support

The image supports multiple architectures:

```bash
# AMD64 (Intel/AMD)
docker pull ghcr.io/osodevops/kafka-backup:latest --platform linux/amd64

# ARM64 (Apple Silicon, Graviton)
docker pull ghcr.io/osodevops/kafka-backup:latest --platform linux/arm64
```

## Debugging

### Enable Verbose Logging

```bash
docker run --rm \
  -e RUST_LOG=debug \
  -v $(pwd)/backup.yaml:/config/backup.yaml:ro \
  ghcr.io/osodevops/kafka-backup:latest \
  -v backup --config /config/backup.yaml
```

### Interactive Shell

```bash
docker run -it --rm \
  --entrypoint /bin/sh \
  ghcr.io/osodevops/kafka-backup:latest
```

### Check Container Logs

```bash
docker logs kafka-backup
docker logs -f kafka-backup  # Follow logs
```

## Troubleshooting

### Network Issues

```bash
# Test connectivity from container
docker run --rm --network host \
  ghcr.io/osodevops/kafka-backup:latest \
  sh -c "nc -zv kafka 9092"
```

### Permission Issues

```bash
# Check volume permissions
ls -la ./backups

# Fix permissions
sudo chown -R 1000:1000 ./backups
```

### DNS Issues

```bash
# Use host networking for DNS
docker run --rm --network host \
  -v $(pwd)/backup.yaml:/config/backup.yaml:ro \
  ghcr.io/osodevops/kafka-backup:latest \
  backup --config /config/backup.yaml
```

## Next Steps

- [Kubernetes Deployment](./kubernetes) - Deploy on K8s
- [Configuration Reference](../reference/config-yaml) - All options
- [Backup to S3](../guides/backup-to-s3) - Cloud storage guide
