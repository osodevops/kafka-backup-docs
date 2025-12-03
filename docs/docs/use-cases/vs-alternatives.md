---
title: Feature Comparison
description: Compare OSO Kafka Backup with MirrorMaker, Confluent Replicator, and other solutions
sidebar_position: 4
---

# Feature Comparison

Compare OSO Kafka Backup with alternative approaches for Kafka data protection.

## Overview

| Solution | Type | Best For |
|----------|------|----------|
| **OSO Kafka Backup** | Backup/Restore | DR, compliance, migration |
| **MirrorMaker 2** | Replication | Active-active, geo-distribution |
| **Confluent Replicator** | Replication | Enterprise replication |
| **Tiered Storage** | Offload | Cost reduction, infinite retention |
| **Custom Scripts** | DIY | Simple use cases |

## Detailed Comparison

### OSO Kafka Backup vs. MirrorMaker 2

| Feature | OSO Kafka Backup | MirrorMaker 2 |
|---------|------------------|---------------|
| **Purpose** | Backup/restore | Real-time replication |
| **Point-in-time recovery** | Yes | No |
| **Data transformation** | Yes (plugins) | Limited |
| **Storage backends** | S3, Azure, GCS, local | Kafka only |
| **Offset preservation** | Built-in | Requires configuration |
| **Network requirement** | One-time transfer | Continuous connection |
| **Compression** | Zstd, LZ4 | Kafka default |
| **Cost** | Storage costs | Double infrastructure |
| **Recovery time** | Minutes-hours | Instant (already replicated) |
| **Data loss (RPO)** | Last backup | Near-zero |

**Choose OSO Kafka Backup when:**
- You need point-in-time recovery
- Clusters can't communicate directly
- Cost optimization is important
- Compliance requires immutable backups

**Choose MirrorMaker 2 when:**
- Near-zero RPO is required
- Active-active is needed
- Real-time geo-distribution
- Network allows continuous sync

### OSO Kafka Backup vs. Confluent Replicator

| Feature | OSO Kafka Backup | Confluent Replicator |
|---------|------------------|----------------------|
| **Licensing** | Open source (MIT) | Commercial |
| **Point-in-time recovery** | Yes | No |
| **Schema Registry sync** | Enterprise | Yes |
| **Offset sync** | Built-in | Yes |
| **Data transformation** | Plugins | SMT (Connect) |
| **Monitoring** | Prometheus | Control Center |
| **Support** | Community/Enterprise | Confluent support |

**Choose OSO Kafka Backup when:**
- Open source is preferred
- PITR is required
- Budget constraints exist
- Not using Confluent Platform

**Choose Confluent Replicator when:**
- Already using Confluent Platform
- Need Schema Registry sync
- Prefer integrated tooling
- Have Confluent support contract

### OSO Kafka Backup vs. Tiered Storage

| Feature | OSO Kafka Backup | Tiered Storage |
|---------|------------------|----------------|
| **Purpose** | Backup/restore | Cost reduction |
| **Point-in-time recovery** | Yes | Limited |
| **Independent from Kafka** | Yes | No (Kafka feature) |
| **Cross-cluster restore** | Yes | No |
| **Compression** | Additional | Kafka default |
| **Availability** | Any Kafka | Kafka 3.0+ / Confluent |
| **Broker dependency** | None | Requires running brokers |

**Choose OSO Kafka Backup when:**
- Cross-cluster recovery needed
- Independent disaster recovery
- Using older Kafka versions
- Compliance requires separate backups

**Choose Tiered Storage when:**
- Primary goal is cost reduction
- Data stays in same cluster
- Using compatible Kafka version
- Simpler operational model preferred

### OSO Kafka Backup vs. Custom Scripts

| Feature | OSO Kafka Backup | Custom Scripts |
|---------|------------------|----------------|
| **Development effort** | None | High |
| **Maintenance** | Vendor managed | Self-maintained |
| **Performance** | Optimized (Rust) | Variable |
| **Features** | Complete | What you build |
| **Reliability** | Production-tested | Depends |
| **Offset management** | Built-in | Must implement |
| **Cloud storage** | Native support | Must implement |

**Choose OSO Kafka Backup when:**
- Don't want to build from scratch
- Need production-ready solution
- Value ongoing development
- Time to market matters

**Choose Custom Scripts when:**
- Very simple requirements
- Unique constraints
- Learning exercise
- Full control required

## Feature Matrix

### Core Features

| Feature | OSO Backup | MM2 | Replicator | Tiered |
|---------|------------|-----|------------|--------|
| Backup to object storage | Yes | No | No | Yes |
| Point-in-time recovery | Yes | No | No | Limited |
| Cross-cluster restore | Yes | Yes | Yes | No |
| Incremental backup | Yes | N/A | N/A | N/A |
| Compression | Zstd/LZ4 | Kafka | Kafka | Kafka |
| Topic selection | Patterns | Patterns | Patterns | All |
| Topic remapping | Yes | Yes | Yes | No |

### Operational Features

| Feature | OSO Backup | MM2 | Replicator | Tiered |
|---------|------------|-----|------------|--------|
| Kubernetes operator | Yes | No | Yes | No |
| GitOps support | CRDs | No | CRDs | No |
| Prometheus metrics | Yes | JMX | JMX | JMX |
| CLI tool | Yes | No | No | No |
| Scheduled operations | Yes | N/A | N/A | N/A |
| Dry-run validation | Yes | No | No | No |

### Enterprise Features

| Feature | OSO Backup | MM2 | Replicator | Tiered |
|---------|------------|-----|------------|--------|
| Field-level encryption | Enterprise | No | No | No |
| Data masking | Enterprise | No | SMT | No |
| Audit logging | Enterprise | No | Yes | No |
| RBAC | Enterprise | No | Yes | No |
| Schema Registry | Enterprise | No | Yes | No |

## Architecture Comparison

### OSO Kafka Backup

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Kafka     │───▶│   Backup    │───▶│   Object    │
│   Cluster   │    │   Service   │    │   Storage   │
└─────────────┘    └─────────────┘    └─────────────┘
                                             │
                                             ▼
                   ┌─────────────┐    ┌─────────────┐
                   │   Target    │◀───│   Restore   │
                   │   Cluster   │    │   Service   │
                   └─────────────┘    └─────────────┘
```

**Pros:**
- Decoupled storage
- Independent recovery
- Cost-effective long-term storage

**Cons:**
- Not real-time
- Recovery takes time

### MirrorMaker 2 / Replicator

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │───▶│   MM2 /     │───▶│   Target    │
│   Cluster   │    │   Replicator│    │   Cluster   │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Pros:**
- Real-time sync
- Active-active possible
- Near-zero RPO

**Cons:**
- No PITR
- Continuous infrastructure cost
- Network dependency

### Tiered Storage

```
┌─────────────────────────────────────────┐
│              Kafka Cluster              │
│  ┌───────────┐      ┌───────────────┐   │
│  │   Hot     │ ───▶ │   Cold        │   │
│  │   Tier    │      │   Tier (S3)   │   │
│  │  (Local)  │      │               │   │
│  └───────────┘      └───────────────┘   │
└─────────────────────────────────────────┘
```

**Pros:**
- Transparent to clients
- Infinite retention
- Cost optimization

**Cons:**
- No cross-cluster recovery
- Broker dependency
- Limited PITR

## Cost Comparison

### Monthly Cost Example (100 GB/day, 30-day retention)

| Solution | Infrastructure | Storage | Network | Total |
|----------|---------------|---------|---------|-------|
| **OSO Backup** (hourly) | $0 | ~$70 | ~$10 | ~$80 |
| **OSO Backup** (daily) | $0 | ~$70 | ~$1 | ~$71 |
| **MM2** | ~$500 | $0 | ~$50 | ~$550 |
| **Replicator** | ~$500+ | $0 | ~$50 | ~$550+ license |
| **Tiered Storage** | $0 | ~$70 | $0 | ~$70 |

*Costs are illustrative and vary by region and provider.*

### Cost Analysis

**OSO Kafka Backup**:
- One-time transfer costs
- Object storage (cheaper than block)
- No additional compute during backup window

**Replication solutions**:
- 2x Kafka infrastructure
- Continuous network transfer
- Ongoing compute costs

## Migration Path

### From MirrorMaker to OSO Backup

If currently using MM2 for backup purposes:

1. Set up OSO Backup alongside MM2
2. Validate backups match replicated data
3. Disable MM2 (keep target cluster temporarily)
4. Rely on OSO Backup for recovery
5. Decommission MM2 target cluster

### From Custom Scripts to OSO Backup

1. Audit current script capabilities
2. Map to OSO Backup configuration
3. Run parallel backups
4. Validate backup contents match
5. Retire custom scripts

## Decision Framework

### Use OSO Kafka Backup If:

- [ ] Point-in-time recovery is important
- [ ] Compliance requires immutable backups
- [ ] Cost optimization is a priority
- [ ] Cross-region/cross-cloud recovery needed
- [ ] Kubernetes-native operations preferred
- [ ] Open source is preferred

### Use Replication (MM2/Replicator) If:

- [ ] Near-zero RPO is required
- [ ] Active-active architecture needed
- [ ] Real-time geo-distribution required
- [ ] Network allows continuous sync
- [ ] Immediate failover is critical

### Use Both When:

- [ ] Defense in depth required
- [ ] Different RPO/RTO for different scenarios
- [ ] Compliance requires multiple protection methods
- [ ] Active-active + disaster recovery needed

## Next Steps

- [Getting Started](../getting-started/quickstart) - Try OSO Kafka Backup
- [Disaster Recovery](./disaster-recovery) - DR planning
- [Migration Guide](./migration) - Migrate from alternatives
