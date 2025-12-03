---
title: Bare Metal Installation
description: Install OSO Kafka Backup on bare metal servers and VMs
sidebar_position: 2
---

# Bare Metal Installation

Install OSO Kafka Backup directly on Linux servers or virtual machines.

## Prerequisites

- Linux (x86_64 or ARM64) or macOS
- Network access to Kafka brokers
- Storage space for backups (local or mounted)

## Download

### Linux (x86_64)

```bash
# Download latest release
curl -L -o kafka-backup.tar.gz \
  https://github.com/osodevops/kafka-backup/releases/latest/download/kafka-backup-linux-amd64.tar.gz

# Extract
tar xzf kafka-backup.tar.gz

# Move to PATH
sudo mv kafka-backup /usr/local/bin/

# Verify installation
kafka-backup --version
```

### Linux (ARM64)

```bash
curl -L -o kafka-backup.tar.gz \
  https://github.com/osodevops/kafka-backup/releases/latest/download/kafka-backup-linux-arm64.tar.gz

tar xzf kafka-backup.tar.gz
sudo mv kafka-backup /usr/local/bin/
```

### macOS

```bash
# Intel Mac
curl -L -o kafka-backup.tar.gz \
  https://github.com/osodevops/kafka-backup/releases/latest/download/kafka-backup-darwin-amd64.tar.gz

# Apple Silicon (M1/M2)
curl -L -o kafka-backup.tar.gz \
  https://github.com/osodevops/kafka-backup/releases/latest/download/kafka-backup-darwin-arm64.tar.gz

tar xzf kafka-backup.tar.gz
sudo mv kafka-backup /usr/local/bin/
```

## Directory Setup

Create directories for configuration and data:

```bash
# Create directories
sudo mkdir -p /etc/kafka-backup
sudo mkdir -p /var/lib/kafka-backup/data
sudo mkdir -p /var/log/kafka-backup

# Set permissions (create dedicated user)
sudo useradd -r -s /bin/false kafka-backup
sudo chown -R kafka-backup:kafka-backup /var/lib/kafka-backup
sudo chown -R kafka-backup:kafka-backup /var/log/kafka-backup
```

## Configuration

Create a backup configuration file:

```bash
sudo tee /etc/kafka-backup/backup.yaml << 'EOF'
mode: backup
backup_id: "daily-backup"

source:
  bootstrap_servers:
    - kafka-1.example.com:9092
    - kafka-2.example.com:9092
    - kafka-3.example.com:9092
  topics:
    include:
      - "*"
    exclude:
      - "__consumer_offsets"
      - "_schemas"

storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"

backup:
  compression: zstd
  compression_level: 3
  checkpoint_interval_secs: 30
  include_offset_headers: true
EOF
```

## Running Manually

```bash
# Run as the kafka-backup user
sudo -u kafka-backup kafka-backup backup --config /etc/kafka-backup/backup.yaml

# With verbose logging
sudo -u kafka-backup kafka-backup -v backup --config /etc/kafka-backup/backup.yaml
```

## Systemd Service

Create a systemd service for automated backups:

```bash
sudo tee /etc/systemd/system/kafka-backup.service << 'EOF'
[Unit]
Description=OSO Kafka Backup Service
After=network.target

[Service]
Type=oneshot
User=kafka-backup
Group=kafka-backup
ExecStart=/usr/local/bin/kafka-backup backup --config /etc/kafka-backup/backup.yaml
StandardOutput=append:/var/log/kafka-backup/backup.log
StandardError=append:/var/log/kafka-backup/backup.log

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/kafka-backup /var/log/kafka-backup
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF
```

## Scheduled Backups with Systemd Timer

Create a timer for scheduled execution:

```bash
sudo tee /etc/systemd/system/kafka-backup.timer << 'EOF'
[Unit]
Description=Run Kafka Backup daily at 2 AM

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF
```

Enable and start the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable kafka-backup.timer
sudo systemctl start kafka-backup.timer

# Check timer status
sudo systemctl list-timers kafka-backup.timer
```

## Scheduled Backups with Cron

Alternative to systemd timer:

```bash
# Edit crontab for kafka-backup user
sudo -u kafka-backup crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/kafka-backup backup --config /etc/kafka-backup/backup.yaml >> /var/log/kafka-backup/backup.log 2>&1
```

## Log Rotation

Configure log rotation:

```bash
sudo tee /etc/logrotate.d/kafka-backup << 'EOF'
/var/log/kafka-backup/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 640 kafka-backup kafka-backup
}
EOF
```

## Monitoring

### Check Backup Status

```bash
# List backups
kafka-backup list --path /var/lib/kafka-backup/data

# Describe latest backup
kafka-backup describe --path /var/lib/kafka-backup/data --backup-id daily-backup

# Validate backup integrity
kafka-backup validate --path /var/lib/kafka-backup/data --backup-id daily-backup
```

### Log Monitoring

```bash
# Follow backup logs
tail -f /var/log/kafka-backup/backup.log

# Check for errors
grep -i error /var/log/kafka-backup/backup.log
```

### Disk Space Monitoring

```bash
# Check backup storage usage
du -sh /var/lib/kafka-backup/data/*

# Monitor with df
df -h /var/lib/kafka-backup
```

## NFS/Mounted Storage

For shared or network storage:

```bash
# Mount NFS volume
sudo mount -t nfs nfs-server:/kafka-backups /var/lib/kafka-backup/data

# Add to /etc/fstab for persistence
echo "nfs-server:/kafka-backups /var/lib/kafka-backup/data nfs defaults 0 0" | sudo tee -a /etc/fstab

# Update configuration
storage:
  backend: filesystem
  path: "/var/lib/kafka-backup/data"
```

## S3 Storage (Instead of Local)

For cloud storage:

```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-west-2"

# Or use instance profile (recommended)
# No credentials needed if running on EC2 with IAM role
```

Update configuration:

```yaml
storage:
  backend: s3
  bucket: my-kafka-backups
  region: us-west-2
  prefix: production/daily
```

## Backup Rotation Script

Create a script to manage backup retention:

```bash
sudo tee /usr/local/bin/kafka-backup-rotate << 'EOF'
#!/bin/bash
BACKUP_PATH="/var/lib/kafka-backup/data"
RETENTION_DAYS=30

# List backups older than retention period
find "$BACKUP_PATH" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -name "backup-*" | while read dir; do
    echo "Removing old backup: $dir"
    rm -rf "$dir"
done

# Log disk usage
echo "Current disk usage:"
du -sh "$BACKUP_PATH"/*
EOF

chmod +x /usr/local/bin/kafka-backup-rotate

# Add to cron (run daily at 3 AM)
echo "0 3 * * * /usr/local/bin/kafka-backup-rotate >> /var/log/kafka-backup/rotation.log 2>&1" | sudo -u kafka-backup crontab -
```

## Troubleshooting

### Permission Denied

```bash
# Check file ownership
ls -la /var/lib/kafka-backup/

# Fix permissions
sudo chown -R kafka-backup:kafka-backup /var/lib/kafka-backup/
```

### Connection Refused

```bash
# Test Kafka connectivity
nc -zv kafka-1.example.com 9092

# Check firewall
sudo iptables -L -n | grep 9092
```

### Out of Disk Space

```bash
# Check disk usage
df -h /var/lib/kafka-backup

# Find large backups
du -sh /var/lib/kafka-backup/data/*

# Remove old backups
kafka-backup list --path /var/lib/kafka-backup/data
rm -rf /var/lib/kafka-backup/data/old-backup-001
```

## Next Steps

- [Configuration Reference](../reference/config-yaml) - All configuration options
- [Security Setup](../guides/security-setup) - TLS and SASL configuration
- [Performance Tuning](../guides/performance-tuning) - Optimize backup speed
