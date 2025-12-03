---
title: Spring Boot
description: Backup and restore Kafka for Spring Boot applications
sidebar_position: 2
---

# Spring Boot Example

This guide shows how to backup and restore Kafka data for Spring Boot applications using Spring Kafka.

## Spring Kafka Architecture

Typical Spring Boot application with Kafka:

```
┌────────────────────────────────────────────────────────────────────┐
│                    Spring Boot Application                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐                      │
│  │  KafkaTemplate   │    │  @KafkaListener  │                      │
│  │  (Producer)      │    │  (Consumer)      │                      │
│  └────────┬─────────┘    └────────┬─────────┘                      │
│           │                       │                                 │
│           │                       │                                 │
│           ▼                       ▼                                 │
│  ┌──────────────────┐    ┌──────────────────┐                      │
│  │   Output Topic   │    │   Input Topic    │                      │
│  │   (orders-out)   │    │   (orders-in)    │                      │
│  └──────────────────┘    └──────────────────┘                      │
│                                                                     │
│  Consumer Group: ${spring.kafka.consumer.group-id}                 │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Sample Application

### Application Properties

```yaml title="application.yml"
spring:
  kafka:
    bootstrap-servers: kafka:9092
    consumer:
      group-id: order-service
      auto-offset-reset: earliest
      enable-auto-commit: false
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    listener:
      ack-mode: MANUAL
```

### Consumer Code

```java
@Service
public class OrderConsumer {

    @KafkaListener(topics = "orders-in", groupId = "order-service")
    public void processOrder(
            @Payload Order order,
            @Header(KafkaHeaders.OFFSET) long offset,
            Acknowledgment ack) {

        log.info("Processing order {} at offset {}", order.getId(), offset);

        // Process order
        orderService.process(order);

        // Manual commit
        ack.acknowledge();
    }
}
```

### Producer Code

```java
@Service
public class OrderProducer {

    private final KafkaTemplate<String, Order> kafkaTemplate;

    public void sendOrder(Order order) {
        kafkaTemplate.send("orders-out", order.getId(), order)
            .whenComplete((result, ex) -> {
                if (ex == null) {
                    log.info("Sent order {} to partition {} offset {}",
                        order.getId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                }
            });
    }
}
```

## Backup Configuration

### Complete Backup

```yaml title="spring-backup.yaml"
mode: backup
backup_id: "order-service-${TIMESTAMP}"

source:
  bootstrap_servers:
    - kafka:9092
  topics:
    include:
      - orders-in
      - orders-out
      # DLQ topics
      - orders-in.DLT
      # Retry topics (if using Spring Retry)
      - orders-in-retry-0
      - orders-in-retry-1
      - orders-in-retry-2

storage:
  backend: s3
  bucket: kafka-backups
  prefix: spring/order-service

backup:
  compression: zstd
  include_offset_headers: true
  source_cluster_id: "production"
```

### Backup with Spring Cloud Stream

If using Spring Cloud Stream:

```yaml
source:
  topics:
    include:
      # Input bindings
      - orders-in
      # Output bindings
      - orders-out
      # Error channel
      - orders-error
      # Spring Cloud Stream internal topics
      - "springCloudBus.*"
```

## Restore Strategies

### Strategy 1: Resume Processing

Restore and continue from where the application left off:

```yaml title="spring-restore-resume.yaml"
mode: restore
backup_id: "order-service-20241201"

target:
  bootstrap_servers:
    - target-kafka:9092

restore:
  include_original_offset_header: true
  consumer_group_strategy: header-based
  reset_consumer_offsets: true
  consumer_groups:
    - order-service

storage:
  backend: s3
  bucket: kafka-backups
  prefix: spring/order-service
```

```bash
# Execute three-phase restore
kafka-backup three-phase-restore --config spring-restore-resume.yaml
```

### Strategy 2: Reprocess All Messages

Restore and reprocess everything from the beginning:

```yaml title="spring-restore-reprocess.yaml"
mode: restore
backup_id: "order-service-20241201"

target:
  bootstrap_servers:
    - target-kafka:9092

restore:
  consumer_group_strategy: earliest
  consumer_groups:
    - order-service
```

### Strategy 3: PITR Restore

Restore to a specific point in time:

```yaml title="spring-restore-pitr.yaml"
mode: restore
backup_id: "order-service-20241201"

target:
  bootstrap_servers:
    - target-kafka:9092

restore:
  time_window_end: 1701450000000  # Before the incident
  include_original_offset_header: true

  consumer_group_strategy: timestamp
  consumer_group_timestamp: 1701450000000
  consumer_groups:
    - order-service
```

## Handling Dead Letter Topics

Spring Kafka's `@RetryableTopic` creates DLT topics:

### Backup DLT Topics

```yaml
source:
  topics:
    include:
      - orders-in
      - orders-in.DLT        # Dead Letter Topic
      - orders-in-retry-0    # Retry topics
      - orders-in-retry-1
      - orders-in-retry-2
```

### Restore DLT for Analysis

```yaml
restore:
  topics:
    - orders-in.DLT

  topic_mapping:
    orders-in.DLT: investigation-orders-dlt
```

### Reprocess DLT Messages

After fixing the issue, reprocess DLT messages:

```java
@KafkaListener(topics = "orders-in.DLT", groupId = "dlt-processor")
public void reprocessDlt(
        @Payload Order order,
        @Header(KafkaHeaders.DLT_ORIGINAL_TOPIC) String originalTopic,
        @Header(KafkaHeaders.DLT_ORIGINAL_OFFSET) long originalOffset) {

    log.info("Reprocessing DLT message from {} offset {}",
        originalTopic, originalOffset);

    // Resend to original topic
    kafkaTemplate.send(originalTopic, order.getId(), order);
}
```

## Consumer Group Management

### Check Consumer Group Status

```bash
# Before restore
kafka-consumer-groups \
  --bootstrap-server kafka:9092 \
  --group order-service \
  --describe

# Output:
# TOPIC       PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# orders-in   0          1000            1500            500
# orders-in   1          800             1200            400
```

### Application-Side Offset Reset

Configure Spring to handle reset:

```yaml title="application.yml"
spring:
  kafka:
    consumer:
      auto-offset-reset: earliest  # or latest
```

### Manual Offset Management

For fine-grained control:

```java
@Component
public class OffsetManager implements ConsumerSeekAware {

    @Override
    public void onPartitionsAssigned(
            Map<TopicPartition, Long> assignments,
            ConsumerSeekCallback callback) {

        // Seek to specific offsets from backup mapping
        assignments.forEach((tp, offset) -> {
            Long targetOffset = getOffsetFromMapping(tp);
            if (targetOffset != null) {
                callback.seek(tp.topic(), tp.partition(), targetOffset);
            }
        });
    }
}
```

## Kubernetes Deployment

### Backup CronJob

```yaml
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaBackup
metadata:
  name: order-service-backup
spec:
  schedule: "0 */2 * * *"  # Every 2 hours
  kafkaCluster:
    bootstrapServers:
      - kafka:9092
  topics:
    - orders-in
    - orders-out
    - orders-in.DLT
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      prefix: spring/order-service
```

### Restore with Application Shutdown

```bash
#!/bin/bash
# restore-order-service.sh

BACKUP_ID="$1"
NAMESPACE="production"
DEPLOYMENT="order-service"

# Step 1: Scale down application
echo "Scaling down $DEPLOYMENT..."
kubectl scale deployment $DEPLOYMENT -n $NAMESPACE --replicas=0
kubectl wait --for=condition=available=false deployment/$DEPLOYMENT -n $NAMESPACE

# Step 2: Run restore
echo "Restoring from backup $BACKUP_ID..."
kubectl apply -f - <<EOF
apiVersion: kafka.oso.sh/v1alpha1
kind: KafkaRestore
metadata:
  name: order-service-restore
  namespace: kafka-backup
spec:
  backupId: "$BACKUP_ID"
  targetCluster:
    bootstrapServers:
      - kafka:9092
  storage:
    storageType: s3
    s3:
      bucket: kafka-backups
      prefix: spring/order-service
  offsetReset:
    strategy: headerBased
    consumerGroups:
      - order-service
EOF

# Wait for restore
kubectl wait --for=condition=complete kafkarestore/order-service-restore -n kafka-backup

# Step 3: Scale up application
echo "Scaling up $DEPLOYMENT..."
kubectl scale deployment $DEPLOYMENT -n $NAMESPACE --replicas=3
```

## Testing Restore Locally

### Docker Compose Setup

```yaml title="docker-compose.yml"
version: '3'
services:
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  order-service:
    build: .
    environment:
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:9092
    depends_on:
      - kafka

  kafka-backup:
    image: osodevops/kafka-backup:latest
    volumes:
      - ./backups:/backups
    depends_on:
      - kafka
```

### Test Script

```bash
#!/bin/bash
# test-restore.sh

# Create backup
docker-compose exec kafka-backup kafka-backup backup \
  --config /config/backup.yaml

# Simulate data loss
docker-compose exec kafka kafka-topics --delete \
  --bootstrap-server kafka:9092 --topic orders-in

# Restore
docker-compose exec kafka-backup kafka-backup restore \
  --config /config/restore.yaml

# Verify
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic orders-in \
  --from-beginning \
  --max-messages 10
```

## Integration Tests

### Test Backup/Restore Cycle

```java
@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {"orders-in", "orders-out"})
class BackupRestoreTest {

    @Autowired
    private EmbeddedKafkaBroker embeddedKafka;

    @Autowired
    private KafkaTemplate<String, Order> kafkaTemplate;

    @Test
    void shouldRestoreMessagesCorrectly() {
        // Send test messages
        for (int i = 0; i < 100; i++) {
            kafkaTemplate.send("orders-in", "order-" + i,
                new Order("order-" + i, 100.0));
        }

        // Run backup (use test configuration)
        // ...

        // Clear topic
        // ...

        // Run restore
        // ...

        // Verify messages restored
        Consumer<String, Order> consumer = createConsumer();
        consumer.subscribe(List.of("orders-in"));

        ConsumerRecords<String, Order> records =
            consumer.poll(Duration.ofSeconds(10));

        assertThat(records.count()).isEqualTo(100);
    }
}
```

## Configuration Reference

### Production Configuration

```yaml title="application-prod.yml"
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS}
    consumer:
      group-id: order-service
      auto-offset-reset: none  # Fail if no offset found
      enable-auto-commit: false
      isolation-level: read_committed
    producer:
      acks: all
      retries: 3
      properties:
        enable.idempotence: true
    listener:
      ack-mode: MANUAL
      concurrency: 3

# Custom backup metadata
backup:
  cluster-id: ${KAFKA_CLUSTER_ID:production}
  app-id: order-service
```

### Access Backup Metadata

```java
@Configuration
public class BackupMetadataConfig {

    @Value("${backup.cluster-id}")
    private String clusterId;

    @Value("${backup.app-id}")
    private String appId;

    // Use in offset header matching
}
```

## Best Practices

1. **Use manual commits** (`enable-auto-commit: false`) for reliable processing
2. **Backup DLT topics** to investigate failures
3. **Test restore process** in staging environment
4. **Scale down before restore** to avoid conflicts
5. **Use idempotent producers** to handle duplicates after restore
6. **Monitor consumer lag** after restore

## Next Steps

- [Kafka Streams Example](./kafka-streams) - Stateful processing
- [Offset Management](../guides/offset-management) - Consumer offsets
- [Kubernetes Deployment](../deployment/kubernetes) - K8s setup
