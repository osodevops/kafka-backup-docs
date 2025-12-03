---
title: Support
description: Get help with OSO Kafka Backup
sidebar_position: 5
---

# Support

Get help with OSO Kafka Backup through community resources or enterprise support.

## Community Support

### GitHub Issues

Report bugs and request features:

- **Repository**: https://github.com/osodevops/kafka-backup
- **Issues**: https://github.com/osodevops/kafka-backup/issues

**Before opening an issue:**
1. Search existing issues for similar problems
2. Check the documentation for solutions
3. Gather relevant information (see below)

**What to include:**
```markdown
## Environment
- OSO Kafka Backup version: X.Y.Z
- Kafka version: X.Y.Z
- Storage backend: S3 / Azure / GCS / Local
- OS: Linux / macOS / Windows
- Deployment: CLI / Docker / Kubernetes

## Problem Description
What you expected vs. what happened

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Configuration (redact sensitive data)
```yaml
mode: backup
source:
  bootstrap_servers:
    - kafka:9092
# ...
```

## Logs
```
[Relevant debug logs]
```

## Additional Context
Any other relevant information
```

### GitHub Discussions

For questions, ideas, and community help:

- **Discussions**: https://github.com/osodevops/kafka-backup/discussions

Categories:
- **Q&A**: Ask questions
- **Ideas**: Feature suggestions
- **Show and Tell**: Share your use cases
- **General**: General discussion

### Community Slack

Join the community Slack for real-time help:

- **Invite link**: https://oso.sh/slack
- **Channel**: #kafka-backup

## Enterprise Support

### Support Tiers

| Tier | Response Time | Availability | Channels |
|------|---------------|--------------|----------|
| **Standard** | 8 business hours | Business hours (M-F) | Email, Portal |
| **Premium** | 4 business hours | Business hours (M-F) | Email, Portal, Slack |
| **Mission Critical** | 1 hour | 24/7/365 | All + Phone |

### Contacting Enterprise Support

**Support Portal**: https://support.oso.sh

**Email**: support@oso.sh

**Phone** (Mission Critical only): Available in contract documentation

### What's Included

**Standard Support:**
- Bug fixes and patches
- Configuration assistance
- Documentation clarification
- Upgrade guidance

**Premium Support:**
- All Standard features
- Architecture review
- Performance tuning assistance
- Dedicated Slack channel

**Mission Critical Support:**
- All Premium features
- 24/7 emergency response
- Dedicated support engineer
- On-call availability

### Creating a Support Ticket

1. Log in to https://support.oso.sh
2. Click "New Ticket"
3. Fill in the details:
   - **Subject**: Brief description
   - **Priority**: Critical / High / Normal / Low
   - **Category**: Bug / Question / Feature Request
   - **Description**: Detailed information
   - **Attachments**: Logs, configs (redacted)

### Priority Definitions

| Priority | Definition | Example |
|----------|------------|---------|
| **Critical** | Production down, no workaround | Backup failing, data at risk |
| **High** | Significant impact, workaround exists | Performance degraded |
| **Normal** | Moderate impact | Non-critical feature issue |
| **Low** | Minimal impact | Documentation question |

## Self-Service Resources

### Documentation

- **This site**: Comprehensive documentation
- **CLI Help**: `kafka-backup --help`
- **Command Help**: `kafka-backup backup --help`

### Troubleshooting Guides

- [Common Errors](./common-errors)
- [Performance Issues](./performance-issues)
- [Offset Discontinuity](./offset-discontinuity)
- [Debug Mode](./debug-mode)

### Version Information

```bash
# Check version
kafka-backup --version

# Detailed version info
kafka-backup version --verbose

# Output:
# OSO Kafka Backup v1.0.0
# Built: 2024-12-01
# Rust: 1.74.0
# librdkafka: 2.3.0
# Features: compression,encryption,audit
```

### Health Check

```bash
# Check system requirements
kafka-backup doctor

# Output:
# ✓ Storage backend reachable
# ✓ Kafka cluster reachable
# ✓ Sufficient disk space
# ✓ Required permissions
# ✓ Configuration valid
```

## Gathering Diagnostic Information

### System Information

```bash
# Version
kafka-backup --version

# Environment
uname -a
cat /etc/os-release  # Linux
sw_vers              # macOS

# Resources
free -h              # Memory
df -h                # Disk
nproc                # CPUs
```

### Configuration

```bash
# Export config (redact passwords!)
kafka-backup config show --config backup.yaml --redact
```

### Logs

```bash
# Enable debug logging
export RUST_LOG=debug
kafka-backup backup --config backup.yaml 2> debug.log

# Compress for upload
gzip debug.log
```

### Network Diagnostics

```bash
# Test Kafka connectivity
kafka-broker-api-versions --bootstrap-server kafka:9092

# Test storage connectivity
aws s3 ls s3://my-bucket/  # S3
az storage blob list --container-name my-container  # Azure
gsutil ls gs://my-bucket/  # GCS
```

### Metrics

```bash
# Prometheus metrics
curl http://localhost:9090/metrics > metrics.txt
```

## Frequently Asked Questions

### General

**Q: Is there a size limit for backups?**
A: No inherent limit. Limited only by storage capacity.

**Q: Can I backup to multiple storage backends?**
A: Not simultaneously. Run separate backups for different backends.

**Q: Is the data encrypted at rest?**
A: Depends on storage backend configuration. S3 SSE, Azure encryption, etc.

### Performance

**Q: Why is my backup slow?**
A: See [Performance Issues](./performance-issues). Common causes: network, compression, storage.

**Q: How can I speed up restore?**
A: Use parallel restores, reduce compression level during backup, use faster storage tier.

### Offsets

**Q: How do I handle consumer offset reset?**
A: Use three-phase restore or header-based offset reset. See [Offset Management](../guides/offset-management).

**Q: Can I restore to a different number of partitions?**
A: Yes, with `scan_all_partitions: true` for offset reset.

### Enterprise

**Q: How do I get an enterprise trial?**
A: Visit https://oso.sh/kafka-backup/trial or run `kafka-backup license request`.

**Q: What features require enterprise?**
A: Encryption, masking, RBAC, audit logging, Schema Registry sync, plugins.

## Release Notes

Stay updated with new releases:

- **Releases**: https://github.com/osodevops/kafka-backup/releases
- **Changelog**: https://github.com/osodevops/kafka-backup/blob/main/CHANGELOG.md

## Security

### Reporting Security Issues

**Do not** report security vulnerabilities through public GitHub issues.

**Email**: security@oso.sh

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and keep you updated on the fix timeline.

### Security Advisories

Published at: https://github.com/osodevops/kafka-backup/security/advisories

## Contributing

We welcome contributions!

- **Contributing Guide**: https://github.com/osodevops/kafka-backup/blob/main/CONTRIBUTING.md
- **Code of Conduct**: https://github.com/osodevops/kafka-backup/blob/main/CODE_OF_CONDUCT.md

Ways to contribute:
- Report bugs
- Suggest features
- Improve documentation
- Submit pull requests

## Contact Information

| Purpose | Contact |
|---------|---------|
| General questions | support@oso.sh |
| Sales inquiries | sales@oso.sh |
| Security issues | security@oso.sh |
| Partnerships | partners@oso.sh |

## Useful Links

- **Website**: https://oso.sh/kafka-backup
- **Documentation**: https://docs.oso.sh/kafka-backup
- **GitHub**: https://github.com/osodevops/kafka-backup
- **Slack**: https://oso.sh/slack
- **Twitter**: https://twitter.com/osodevops

## Next Steps

- [Common Errors](./common-errors) - Error reference
- [Debug Mode](./debug-mode) - Enable debugging
- [Getting Started](../getting-started/quickstart) - Quick start guide
