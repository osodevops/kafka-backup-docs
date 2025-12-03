---
title: AWS Lambda
description: Backup and restore Kafka for AWS Lambda consumers
sidebar_position: 3
---

# AWS Lambda Example

This guide shows how to backup and restore Kafka data consumed by AWS Lambda functions using Amazon MSK as an event source.

## Lambda with MSK Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Account                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐         │
│  │    Amazon    │     │   Lambda     │     │    Other     │         │
│  │     MSK      │────▶│  Function    │────▶│   Services   │         │
│  │              │     │              │     │  (DynamoDB,  │         │
│  │  ┌────────┐  │     │              │     │   S3, etc)   │         │
│  │  │ orders │  │     │              │     │              │         │
│  │  └────────┘  │     └──────────────┘     └──────────────┘         │
│  └──────────────┘                                                    │
│        │                                                             │
│        │ Backup                                                      │
│        ▼                                                             │
│  ┌──────────────┐                                                    │
│  │   S3 Bucket  │                                                    │
│  │   (Backups)  │                                                    │
│  └──────────────┘                                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Lambda MSK Event Source

AWS Lambda can consume from MSK/Kafka using Event Source Mapping:

```javascript
// Lambda function receiving Kafka events
exports.handler = async (event) => {
    for (const record of event.records) {
        for (const topicRecord of record.value) {
            const key = Buffer.from(topicRecord.key, 'base64').toString();
            const value = Buffer.from(topicRecord.value, 'base64').toString();
            const offset = topicRecord.offset;

            console.log(`Processing record: key=${key}, offset=${offset}`);

            // Process the message
            await processOrder(JSON.parse(value));
        }
    }

    return { statusCode: 200 };
};
```

### Event Source Mapping Configuration

```json
{
  "EventSourceArn": "arn:aws:kafka:us-west-2:123456789:cluster/my-cluster/abc123",
  "FunctionName": "order-processor",
  "Topics": ["orders"],
  "StartingPosition": "LATEST",
  "BatchSize": 100,
  "MaximumBatchingWindowInSeconds": 5,
  "DestinationConfig": {
    "OnFailure": {
      "Destination": "arn:aws:sqs:us-west-2:123456789:orders-dlq"
    }
  }
}
```

## Backup Configuration

### Backup from Amazon MSK

```yaml title="msk-backup.yaml"
mode: backup
backup_id: "msk-orders-${TIMESTAMP}"

source:
  bootstrap_servers:
    - b-1.my-cluster.abc123.kafka.us-west-2.amazonaws.com:9092
    - b-2.my-cluster.abc123.kafka.us-west-2.amazonaws.com:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: AWS_MSK_IAM

  topics:
    include:
      - orders
      - order-events
      - notifications

storage:
  backend: s3
  bucket: kafka-backups
  region: us-west-2
  prefix: msk/orders

backup:
  compression: zstd
  include_offset_headers: true
  source_cluster_id: "msk-production"
```

### IAM Authentication

For MSK with IAM authentication:

```yaml
source:
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: AWS_MSK_IAM
    # Uses default credential chain (IAM role, env vars, etc.)
```

IAM Policy for backup:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:Connect",
        "kafka-cluster:DescribeTopic",
        "kafka-cluster:ReadData",
        "kafka-cluster:DescribeGroup"
      ],
      "Resource": [
        "arn:aws:kafka:us-west-2:123456789:cluster/my-cluster/*",
        "arn:aws:kafka:us-west-2:123456789:topic/my-cluster/*",
        "arn:aws:kafka:us-west-2:123456789:group/my-cluster/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::kafka-backups",
        "arn:aws:s3:::kafka-backups/*"
      ]
    }
  ]
}
```

## Lambda Consumer Group Handling

### Understanding Lambda Consumer Groups

Lambda uses auto-generated consumer group IDs:

```
Consumer Group ID Pattern:
amazon.lambda.{event-source-uuid}

Example:
amazon.lambda.12345678-1234-1234-1234-123456789012
```

### Finding Lambda Consumer Group

```bash
# List consumer groups
aws kafka list-groups \
  --cluster-arn arn:aws:kafka:us-west-2:123456789:cluster/my-cluster/abc123

# Or via Kafka tools
kafka-consumer-groups \
  --bootstrap-server b-1.my-cluster.abc123.kafka.us-west-2.amazonaws.com:9092 \
  --list \
  --command-config msk.properties
```

### Backup with Lambda Consumer Group

```yaml
backup:
  include_offset_headers: true
  source_cluster_id: "msk-production"

  # Track Lambda consumer position
  consumer_groups:
    - "amazon.lambda.12345678-1234-1234-1234-123456789012"
```

## Restore Strategies

### Strategy 1: Restore and Reset Lambda

```yaml title="msk-restore.yaml"
mode: restore
backup_id: "msk-orders-20241201"

target:
  bootstrap_servers:
    - b-1.my-cluster.abc123.kafka.us-west-2.amazonaws.com:9092
  security:
    security_protocol: SASL_SSL
    sasl_mechanism: AWS_MSK_IAM

storage:
  backend: s3
  bucket: kafka-backups
  prefix: msk/orders

restore:
  include_original_offset_header: true
```

After restore, reset Lambda event source:

```bash
# Delete and recreate event source mapping
aws lambda delete-event-source-mapping \
  --uuid 12345678-1234-1234-1234-123456789012

aws lambda create-event-source-mapping \
  --function-name order-processor \
  --event-source-arn arn:aws:kafka:us-west-2:123456789:cluster/my-cluster/abc123 \
  --topics orders \
  --starting-position TRIM_HORIZON  # Start from beginning
```

### Strategy 2: PITR with Lambda

```yaml
restore:
  time_window_end: 1701450000000

  # Lambda will need to start from TRIM_HORIZON
  # to process restored messages
```

### Strategy 3: Resume from Position

For resuming exactly where Lambda left off:

```bash
# Get current Lambda offset position
OFFSET=$(kafka-consumer-groups \
  --bootstrap-server b-1.my-cluster.abc123.kafka.us-west-2.amazonaws.com:9092 \
  --group amazon.lambda.12345678-1234-1234-1234-123456789012 \
  --describe \
  --command-config msk.properties | grep orders | awk '{print $4}')

# Note: Lambda event source mapping doesn't support custom offset
# Must use TRIM_HORIZON or LATEST
```

## AWS Lambda Function for Backup

Run backups using Lambda:

```javascript
// backup-lambda.js
const { execSync } = require('child_process');
const path = require('path');

exports.handler = async (event) => {
    const backupId = `msk-backup-${Date.now()}`;

    const config = {
        mode: 'backup',
        backup_id: backupId,
        source: {
            bootstrap_servers: [process.env.MSK_BOOTSTRAP_SERVERS],
            security: {
                security_protocol: 'SASL_SSL',
                sasl_mechanism: 'AWS_MSK_IAM'
            },
            topics: {
                include: event.topics || ['orders']
            }
        },
        storage: {
            backend: 's3',
            bucket: process.env.BACKUP_BUCKET,
            prefix: 'msk-backups'
        },
        backup: {
            compression: 'zstd',
            include_offset_headers: true
        }
    };

    // Write config
    const configPath = '/tmp/backup-config.yaml';
    require('fs').writeFileSync(configPath, require('yaml').stringify(config));

    // Execute backup
    try {
        execSync(`/opt/kafka-backup backup --config ${configPath}`, {
            stdio: 'inherit'
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ backup_id: backupId })
        };
    } catch (error) {
        console.error('Backup failed:', error);
        throw error;
    }
};
```

### Lambda Layer for kafka-backup

```dockerfile
# Dockerfile for Lambda layer
FROM amazonlinux:2

RUN yum install -y curl tar gzip

# Download kafka-backup binary
RUN curl -L https://github.com/osodevops/kafka-backup/releases/latest/download/kafka-backup-linux-amd64.tar.gz | \
    tar xz -C /opt

# Create layer structure
RUN mkdir -p /opt/layer && \
    cp /opt/kafka-backup /opt/layer/

# Package layer
WORKDIR /opt/layer
RUN zip -r /opt/layer.zip .
```

## EventBridge Scheduled Backups

### CloudWatch Event Rule

```json
{
  "Name": "msk-backup-schedule",
  "ScheduleExpression": "rate(1 hour)",
  "State": "ENABLED",
  "Targets": [
    {
      "Id": "backup-lambda",
      "Arn": "arn:aws:lambda:us-west-2:123456789:function:msk-backup",
      "Input": "{\"topics\": [\"orders\", \"order-events\"]}"
    }
  ]
}
```

### Terraform Configuration

```hcl
resource "aws_cloudwatch_event_rule" "backup_schedule" {
  name                = "msk-backup-schedule"
  description         = "Trigger MSK backup every hour"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "backup_lambda" {
  rule      = aws_cloudwatch_event_rule.backup_schedule.name
  target_id = "backup-lambda"
  arn       = aws_lambda_function.backup.arn

  input = jsonencode({
    topics = ["orders", "order-events"]
  })
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.backup_schedule.arn
}
```

## DLQ Integration

### Backup DLQ Messages

When Lambda fails, messages go to SQS DLQ. Backup both:

```yaml
source:
  topics:
    include:
      - orders

# Also backup SQS DLQ separately (different tool needed)
```

### Restore Failed Messages

```javascript
// Lambda to move DLQ messages back to Kafka
const AWS = require('aws-sdk');
const { Kafka } = require('kafkajs');

exports.handler = async (event) => {
    const sqs = new AWS.SQS();
    const kafka = new Kafka({
        clientId: 'dlq-replayer',
        brokers: [process.env.MSK_BOOTSTRAP_SERVERS],
        ssl: true,
        sasl: {
            mechanism: 'aws',
            authorizationIdentity: 'msk-admin',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
    });

    const producer = kafka.producer();
    await producer.connect();

    // Receive messages from DLQ
    const response = await sqs.receiveMessage({
        QueueUrl: process.env.DLQ_URL,
        MaxNumberOfMessages: 10
    }).promise();

    for (const message of response.Messages || []) {
        const kafkaMessage = JSON.parse(message.Body);

        // Resend to Kafka
        await producer.send({
            topic: 'orders',
            messages: [{ key: kafkaMessage.key, value: kafkaMessage.value }]
        });

        // Delete from DLQ
        await sqs.deleteMessage({
            QueueUrl: process.env.DLQ_URL,
            ReceiptHandle: message.ReceiptHandle
        }).promise();
    }

    await producer.disconnect();
};
```

## Cross-Region DR

### Backup in Primary Region

```yaml title="backup-us-west-2.yaml"
source:
  bootstrap_servers:
    - b-1.primary-cluster.kafka.us-west-2.amazonaws.com:9092

storage:
  backend: s3
  bucket: kafka-backups-us-west-2
  region: us-west-2
  prefix: primary

  # Enable cross-region replication in S3
```

### Restore in DR Region

```yaml title="restore-us-east-1.yaml"
target:
  bootstrap_servers:
    - b-1.dr-cluster.kafka.us-east-1.amazonaws.com:9092

storage:
  backend: s3
  bucket: kafka-backups-us-east-1  # Replicated bucket
  region: us-east-1
  prefix: primary
```

## Monitoring

### CloudWatch Metrics

```javascript
// Lambda backup function with metrics
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

async function reportMetrics(backupStats) {
    await cloudwatch.putMetricData({
        Namespace: 'KafkaBackup',
        MetricData: [
            {
                MetricName: 'RecordsBackedUp',
                Value: backupStats.records,
                Unit: 'Count'
            },
            {
                MetricName: 'BackupDurationSeconds',
                Value: backupStats.duration,
                Unit: 'Seconds'
            },
            {
                MetricName: 'BackupSizeBytes',
                Value: backupStats.bytes,
                Unit: 'Bytes'
            }
        ]
    }).promise();
}
```

### CloudWatch Alarms

```json
{
  "AlarmName": "KafkaBackupFailed",
  "MetricName": "Errors",
  "Namespace": "AWS/Lambda",
  "Dimensions": [
    {
      "Name": "FunctionName",
      "Value": "msk-backup"
    }
  ],
  "Statistic": "Sum",
  "Period": 3600,
  "EvaluationPeriods": 1,
  "Threshold": 1,
  "ComparisonOperator": "GreaterThanOrEqualToThreshold",
  "AlarmActions": ["arn:aws:sns:us-west-2:123456789:alerts"]
}
```

## Best Practices

1. **Use IAM authentication** for MSK when possible
2. **Schedule backups** via EventBridge
3. **Enable S3 cross-region replication** for DR
4. **Monitor Lambda errors** with CloudWatch
5. **Handle DLQ messages** separately
6. **Test restore in DR region** regularly

## Next Steps

- [Multi-Cluster DR](./multi-cluster-dr) - Complex DR scenarios
- [AWS S3 Setup](../deployment/cloud-setup/aws-s3) - S3 configuration
- [Disaster Recovery](../use-cases/disaster-recovery) - DR planning
