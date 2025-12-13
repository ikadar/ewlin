---
tags:
  - specification
  - requirements
---

# Non-Functional Requirements – Operations Research System

This document defines the non-functional requirements for the Equipment → Operator → Job → Task assignment and validation system.

Non-functional requirements specify the quality attributes and constraints that the system must meet beyond its functional capabilities.

---

## 1. Performance Requirements

### NFR-PERF-001 – Response Time
- Web UI response time must be < 200ms for page loads (95th percentile)
- API response time must be < 500ms for simple queries
- Complex validation operations must complete within 5 seconds
- Schedule generation for 100 tasks must complete within 10 seconds

### NFR-PERF-002 – Throughput
- System must support minimum 100 concurrent users
- Must handle at least 1000 task assignments per hour
- Database must support 10,000 transactions per minute
- Event processing must handle 500 events per second

### NFR-PERF-003 – Resource Usage
- Server CPU usage must stay below 70% under normal load
- Memory usage must not exceed 4GB per service instance
- Database connections pool must not exceed 100 connections
- Client-side JavaScript bundle must be < 2MB gzipped

---

## 2. Security Requirements

### NFR-SEC-001 – Authentication
- Multi-factor authentication must be supported
- Session timeout after 30 minutes of inactivity
- Password must meet complexity requirements (min 8 chars, mixed case, numbers, special chars)
- Account lockout after 5 failed login attempts

### NFR-SEC-002 – Authorization
- Role-based access control (RBAC) must be implemented
- Principle of least privilege must be enforced
- API endpoints must validate permissions on each request
- Resource-level permissions for sensitive operations

### NFR-SEC-003 – Data Protection
- All data in transit must use TLS 1.2 or higher
- Sensitive data must be encrypted at rest using AES-256
- Database backups must be encrypted
- Personal data must be anonymizable for GDPR compliance

### NFR-SEC-004 – Audit Trail
- All data modifications must be logged with user, timestamp, and changes
- Login attempts must be logged (successful and failed)
- Permission changes must be logged
- Logs must be tamper-proof and retained for 1 year

---

## 3. Usability Requirements

### NFR-USE-001 – User Interface
- UI must be responsive and work on desktop, tablet, and mobile
- Must support Chrome, Firefox, Safari, Edge (latest 2 versions)
- Drag-and-drop scheduling must work on touch devices
- UI must be accessible (WCAG 2.1 AA compliance)

### NFR-USE-002 – User Experience
- Common tasks must be completable in < 3 clicks
- Error messages must be clear and actionable
- Loading states must be shown for operations > 1 second
- Undo functionality for critical operations

### NFR-USE-003 – Internationalization
- UI must support multiple languages (initially English and Hungarian)
- Date/time formats must be locale-specific
- Number formats must follow locale conventions
- Time zones must be handled correctly

---

## 4. Reliability Requirements

### NFR-REL-001 – Availability
- System uptime must be 99.9% (excluding planned maintenance)
- Planned maintenance windows < 4 hours per month
- Unplanned downtime must not exceed 8 hours per year
- Graceful degradation when external services unavailable

### NFR-REL-002 – Fault Tolerance
- System must continue operating if one service fails
- Database must support automatic failover
- No single point of failure in architecture
- Circuit breakers for external service calls

### NFR-REL-003 – Data Integrity
- Zero data loss for committed transactions
- Database ACID compliance required
- Eventual consistency acceptable for read models (< 5 seconds)
- Referential integrity must be maintained

### NFR-REL-004 – Recovery
- Recovery Point Objective (RPO): < 1 hour
- Recovery Time Objective (RTO): < 4 hours
- Automated backup every 6 hours
- Point-in-time recovery capability

---

## 5. Scalability Requirements

### NFR-SCAL-001 – Vertical Scaling
- Services must scale up to 16 CPU cores
- Database must handle up to 64GB RAM efficiently
- Cache layer must support up to 32GB

### NFR-SCAL-002 – Horizontal Scaling
- Services must be stateless for horizontal scaling
- Load balancing must distribute requests evenly
- Database must support read replicas
- Must handle 10x current load with linear scaling

### NFR-SCAL-003 – Data Volume
- Support up to 10,000 operators
- Support up to 5,000 equipment items
- Handle 100,000 tasks per month
- Store 2 years of historical data online

### NFR-SCAL-004 – Flux Print Shop Specific Limits
- Support ~300 concurrent (non-completed) jobs
- Support up to 100 stations (MVP: dozens)
- Display time range: dynamic (jobs completed within last 14 days visible)
- Support unlimited outsourced provider capacity

---

## 6. Compatibility Requirements

### NFR-COMP-001 – Integration
- REST API must follow OpenAPI 3.0 specification
- Must support JSON and XML data formats
- Webhook support for external notifications
- Import/export in standard formats (CSV, Excel)

### NFR-COMP-002 – Platform
- Backend must run on Linux (Ubuntu 20.04+, RHEL 8+)
- Must support containerization (Docker/Kubernetes)
- Database compatible with MariaDB 10.5+
- PHP 8.1+ compatibility required

### NFR-COMP-003 – Standards
- ISO 8601 for date/time representation
- UTF-8 encoding throughout
- RFC 7231 for HTTP status codes
- OAuth 2.0 for API authentication

---

## 7. Maintainability Requirements

### NFR-MAIN-001 – Code Quality
- Code coverage must be > 80%
- Cyclomatic complexity < 10 per method
- No critical issues in static analysis
- Documented API with examples

### NFR-MAIN-002 – Monitoring
- Application metrics exposed via Prometheus format
- Centralized logging with correlation IDs
- Health check endpoints for each service
- Performance monitoring with APM tools

### NFR-MAIN-003 – Deployment
- Zero-downtime deployments required
- Rollback capability within 5 minutes
- Infrastructure as Code (IaC) for all resources
- Automated deployment pipeline

### NFR-MAIN-004 – Documentation
- Architecture documentation must be current
- API documentation auto-generated from code
- Runbook for common operational tasks
- Troubleshooting guide for support team

---

## 8. Operational Requirements

### NFR-OPS-001 – Backup and Archive
- Daily incremental backups
- Weekly full backups
- Monthly archives to cold storage
- Annual data retention policy review

### NFR-OPS-002 – Monitoring and Alerting
- Real-time monitoring dashboard
- Alerts for critical issues (< 5 minute delay)
- Capacity planning reports monthly
- SLA compliance reporting

### NFR-OPS-003 – Environment Management
- Separate dev, test, staging, production environments
- Production-like data in staging
- Environment refresh procedures
- Configuration management via environment variables

---

## 9. Compliance Requirements

### NFR-COMP-001 – Data Privacy
- GDPR compliance for EU users
- Right to be forgotten implementation
- Data portability support
- Privacy by design principles

### NFR-COMP-002 – Industry Standards
- SOC 2 Type II compliance readiness
- ISO 27001 alignment
- OWASP Top 10 security practices
- Industry-specific regulations as applicable

---

## 10. Constraints

### NFR-CON-001 – Technical Constraints
- Must use Symfony framework
- Must use MariaDB database
- Frontend must use React + TypeScript
- Must deploy to on-premise infrastructure initially

### NFR-CON-002 – Business Constraints
- Budget constraint of €100k for first year
- Team size limited to 5 developers
- Go-live date within 6 months
- Phased rollout required

### NFR-CON-003 – Legal Constraints
- Software licenses must be commercial-use compatible
- Data residency requirements for certain clients
- Audit requirements for financial data
- Export control compliance for international use

---

This document should be reviewed and updated regularly as the system evolves and new requirements emerge.
