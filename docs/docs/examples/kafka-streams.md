---
title: Kafka Streams
description: Backup and restore Kafka Streams applications
sidebar_position: 1
---

# Kafka Streams Example

This guide shows how to backup and restore data for Kafka Streams applications, including state stores and changelog topics.

## Kafka Streams Architecture

Kafka Streams applications create internal topics:

```
┌────────────────────────────────────────────────────────────────────┐
│                    Kafka Streams Application                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input Topics          State Stores          Output Topics          │
│  ┌─────────────┐      ┌─────────────┐       ┌─────────────┐        │
│  │   orders    │ ───▶ │ order-store │ ───▶  │  enriched-  │        │
│  │             │      │ (RocksDB)   │       │   orders    │        │
│  └─────────────┘      └──────┬──────┘       └─────────────┘        │
│                              │                                      │
│                              ▼                                      │
│                    ┌─────────────────────┐                         │
│                    │ app-id-order-store- │ (Changelog topic)       │
│                    │ changelog           │                         │
│                    └─────────────────────┘                         │
│                                                                     │
│                    ┌─────────────────────┐                         │
│                    │ app-id-KSTREAM-     │ (Repartition topic)     │
│                    │ REPARTITION-0000    │                         │
│                    └─────────────────────┘                         │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## What to Backup

For complete Kafka Streams recovery:

| Topic Type | Backup | Why |
|------------|--------|-----|
| Input topics | Yes | Source data |
| Output topics | Yes | Processed results |
| Changelog topics | Yes | State store data |
| Repartition topics | Optional | Can be recreated |

## Backup Configuration

### Full Backup (Recommended)

```yaml title="streams-backup.yaml"
mode: backup
backup_id: "streams-backup-${TIMESTAMP}"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      # Input topics
      - orders
      - inventory
      - customers

      # Output topics
      - enriched-orders
      - order-totals
      - alerts

      # Internal topics (by application.id)
      - "order-processor-*"  # Captures changelog and repartition

    exclude:
      # Skip repartition topics if desired (can be recreated)
      - "*-repartition-*"

storage:
  backend: s3
  bucket: kafka-backups
  prefix: streams/order-processor

backup:
  compression: zstd
  compression_level: 3
  include_offset_headers: true
  source_cluster_id: "production"
```

### Minimal Backup

Backup only input and output topics:

```yaml
source:
  topics:
    include:
      - orders
      - inventory
      - customers
      - enriched-orders
      - order-totals

    # Skip internal topics (state will be rebuilt from input)
    exclude:
      - "order-processor-*"
```

## Restore Strategies

### Strategy 1: Full Restore with State

Restore everything including state stores:

```yaml title="streams-restore-full.yaml"
mode: restore
backup_id: "streams-backup-20241201"

target:
  bootstrap_servers:
    - target-kafka:9092

storage:
  backend: s3
  bucket: kafka-backups
  prefix: streams/order-processor

restore:
  # Restore all topics including changelog
  topics:
    - orders
    - inventory
    - customers
    - enriched-orders
    - order-totals
    - "order-processor-*"

  include_original_offset_header: true
```

After restore:

```bash
# Restart Streams application
# It will load state from changelog topics
java -jar order-processor.jar
```

### Strategy 2: Rebuild State from Input

Restore only input topics, let Streams rebuild state:

```yaml title="streams-restore-rebuild.yaml"
mode: restore
backup_id: "streams-backup-20241201"

target:
  bootstrap_servers:
    - target-kafka:9092

restore:
  topics:
    - orders
    - inventory
    - customers

  # Reset to beginning to reprocess all data
  consumer_group_strategy: earliest
```

After restore:

```bash
# Delete state store directory
rm -rf /var/kafka-streams/order-processor

# Reset application to reprocess
kafka-streams-application-reset \
  --bootstrap-servers target-kafka:9092 \
  --application-id order-processor \
  --input-topics orders,inventory,customers

# Restart application
java -jar order-processor.jar
```

### Strategy 3: PITR with State Consistency

For point-in-time recovery, ensure state matches:

```yaml title="streams-restore-pitr.yaml"
mode: restore
backup_id: "streams-backup-20241201"

restore:
  # Restore to specific point
  time_window_end: 1701450000000

  topics:
    # Input topics up to PITR point
    - orders
    - inventory
    - customers

    # DON'T restore changelog - state won't match PITR point
    # State will be rebuilt from input
```

## Consumer Offset Management

### Kafka Streams Consumer Groups

Kafka Streams uses consumer groups named `{application.id}`:

```bash
# View Streams consumer group
kafka-consumer-groups \
  --bootstrap-server kafka:9092 \
  --group order-processor \
  --describe
```

### Reset for Reprocessing

Using Kafka Streams reset tool:

```bash
kafka-streams-application-reset \
  --bootstrap-servers target-kafka:9092 \
  --application-id order-processor \
  --input-topics orders,inventory,customers \
  --to-earliest
```

Using OSO Kafka Backup:

```yaml
offset_reset:
  groups:
    - order-processor
  strategy: earliest
```

### Resume from Position

If restoring with changelog:

```yaml
offset_reset:
  groups:
    - order-processor
  strategy: header-based
  source_cluster: "production"
```

## Example: Order Processing Application

### Application Code

```java
// Order processing Kafka Streams application
Properties props = new Properties();
props.put(StreamsConfig.APPLICATION_ID_CONFIG, "order-processor");
props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9092");

StreamsBuilder builder = new StreamsBuilder();

// State store for order aggregation
builder.addStateStore(
    Stores.keyValueStoreBuilder(
        Stores.persistentKeyValueStore("order-totals"),
        Serdes.String(),
        Serdes.Double()
    )
);

// Process orders
builder.stream("orders", Consumed.with(Serdes.String(), orderSerde))
    .groupByKey()
    .aggregate(
        () -> 0.0,
        (key, order, total) -> total + order.getAmount(),
        Materialized.as("order-totals")
    )
    .toStream()
    .to("customer-totals");
```

### Internal Topics Created

```
order-processor-order-totals-changelog
order-processor-order-totals-repartition
```

### Backup Script

```bash
#!/bin/bash
# backup-streams.sh

APP_ID="order-processor"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

cat > /tmp/streams-backup.yaml << EOF
mode: backup
backup_id: "${APP_ID}-${TIMESTAMP}"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - orders
      - customer-totals
      - "${APP_ID}-*"

storage:
  backend: s3
  bucket: kafka-backups
  prefix: streams/${APP_ID}

backup:
  compression: zstd
  include_offset_headers: true
  source_cluster_id: "production"
EOF

kafka-backup backup --config /tmp/streams-backup.yaml
```

### Restore Script

```bash
#!/bin/bash
# restore-streams.sh

APP_ID="order-processor"
BACKUP_ID="$1"

# Step 1: Stop the Streams application
kubectl scale deployment ${APP_ID} --replicas=0

# Step 2: Restore data
cat > /tmp/streams-restore.yaml << EOF
mode: restore
backup_id: "${BACKUP_ID}"

target:
  bootstrap_servers:
    - target-kafka:9092

storage:
  backend: s3
  bucket: kafka-backups
  prefix: streams/${APP_ID}

restore:
  topics:
    - orders
    - customer-totals
    - "${APP_ID}-*"
  include_original_offset_header: true
EOF

kafka-backup three-phase-restore --config /tmp/streams-restore.yaml

# Step 3: Restart Streams application
kubectl scale deployment ${APP_ID} --replicas=3
```

## State Store Considerations

### Local State Directory

Kafka Streams stores state locally:

```
/var/kafka-streams/{application.id}/{task.id}/
├── rocksdb/
│   └── order-totals/
│       ├── CURRENT
│       ├── MANIFEST-000001
│       ├── OPTIONS-000001
│       └── 000001.sst
└── .checkpoint
```

### State Restoration Options

| Option | Method | Time | Consistency |
|--------|--------|------|-------------|
| From changelog | Restore changelog topics | Fast | Exact state |
| Rebuild | Reprocess input topics | Slow | Eventually consistent |
| Standby replicas | Use standby task | Instant | Exact state |

### Standby Replicas

Configure standby replicas for faster recovery:

```java
props.put(StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG, 1);
```

## Testing the Restore

### Verify Input Topics

```bash
# Check topic exists with data
kafka-console-consumer \
  --bootstrap-server target-kafka:9092 \
  --topic orders \
  --from-beginning \
  --max-messages 10
```

### Verify Changelog Topics

```bash
# Check changelog has state
kafka-console-consumer \
  --bootstrap-server target-kafka:9092 \
  --topic order-processor-order-totals-changelog \
  --from-beginning \
  --max-messages 10 \
  --property print.key=true
```

### Verify Application State

```bash
# Query state store via interactive query
curl http://streams-app:8080/state/order-totals/customer-123
```

## Kubernetes Deployment

### Backup CronJob

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: streams-backup
  namespace: kafka-backup
spec:
  schedule: "0 * * * *"  # Hourly
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  topics:
    - orders
    - customer-totals
    - "order-processor-*"
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: streams/order-processor
  compression: zstd
```

### Restore Job

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: streams-restore
  namespace: kafka-backup
spec:
  backupId: "order-processor-20241201-100000"
  targetCluster:
    bootstrapServers:
      - target-kafka:9092
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      region: us-west-2
      prefix: streams/order-processor
  offsetReset:
    strategy: headerBased
    consumerGroups:
      - order-processor
```

## Best Practices

1. **Include changelog topics** for fast state recovery
2. **Use application.id prefix** to capture all internal topics
3. **Test state consistency** after restore
4. **Consider standby replicas** for production deployments
5. **Document internal topic naming** for your applications

## Next Steps

- [Spring Boot Example](./spring-boot) - Spring Kafka integration
- [Offset Management](../guides/offset-management) - Consumer offset handling
- [Disaster Recovery](../use-cases/disaster-recovery) - DR planning
