---
tags:
  - specification
  - architecture
---

# Security, Performance & Scalability Design Notes – Flux Print Shop Scheduling System

This document captures **architectural decisions** related to security, performance, and scalability for the Station → Job → Element → Task assignment and scheduling workflow.

These are *design-level* notes, complementing the non-functional requirements (NFRs) with concrete architectural choices.

---

## 1. Security Design Notes

### 1.1 Authentication & Authorization
- All APIs require authentication via JWT tokens with 30-minute expiry
- Authorization uses **role-based access control** model:
  - Production Schedulers can create/modify all assignments and schedules
  - Production Managers can manage jobs, stations, and station groups
  - Administrators have full system access
- Service-to-service communication uses API keys with request signing
- Frontend authentication via OAuth2 with refresh tokens

### 1.2 Data Protection
- Client data (contact info, job descriptions) encrypted at rest using AES-256
- TLS 1.3 enforced for all API communication
- Sensitive operations logged with entity IDs only (station/job IDs)
- Database connections use SSL with certificate validation
- No credentials or sensitive data in environment variables

### 1.3 Audit & Compliance
- Critical events must be logged with immutable audit trail:
  - Task assignments (who assigned what to which station and when)
  - Schedule modifications (before/after state)
  - Station status changes (maintenance, out of service)
  - Access to sensitive reports
- Audit logs stored separately from operational data
- 1-year retention for compliance
- GDPR compliance for client data (right to deletion, data portability)

---

## 2. Performance Design Notes

### 2.1 API Performance
- Synchronous APIs must return within:
  - **200ms p95** for simple queries (resource lists, job details)
  - **500ms p95** for complex operations (assignment validation)
  - **5s p99** for full schedule validation
- Heavy operations run asynchronously:
  - Schedule optimization
  - Schedule snapshot generation for large datasets
  - Bulk assignment operations

### 2.2 Database Access
- Indexes required on:
  - stationId, jobId, elementId (for entity lookups)
  - taskId, targetId (for assignment queries)
  - scheduled_start, scheduled_end (for time-based queries)
  - Foreign key relationships
- Query optimization:
  - Eager loading for job → elements → tasks
  - Pagination mandatory for lists (max 100 items)
  - Database views for complex schedule queries
- Connection pooling: 20 connections per service instance

### 2.3 Caching Strategy
- **Redis** for frequently accessed data:
  - Station schedules and availability (5-minute TTL)
  - Station status and categories (5-minute TTL)
  - Job structure with elements and tasks (invalidate on change)
- **Application-level caching**:
  - Precedence validation results (invalidate on element/task change)
  - Schedule conflict state (1-minute TTL)
- **CDN** for static assets and read-only reports

### 2.4 Real-time Updates
- WebSocket connections for schedule updates
- Server-Sent Events for task status changes
- Maximum 1000 concurrent connections per server
- Graceful degradation to polling if WebSocket fails

---

## 3. Scalability Design Notes

### 3.1 Horizontal Scaling
- Stateless application design for all services
- Session data in Redis (not in-process)
- File uploads to S3-compatible object storage
- No server-side state beyond database

### 3.2 Service Boundaries for Scaling
- Services can be independently scaled based on load:
  - **Station Management**: Low write, high read volume
  - **Job Management**: Moderate read/write (element and task operations)
  - **Assignment & Validation**: CPU-intensive, scale horizontally
  - **Scheduling View**: Read-heavy, use read replicas
  - **Business Calendar**: Stateless, lightweight computation
- Event bus handles backpressure between services

> **Note:** Execution Tracking Service is planned for post-MVP and is not included in current scaling considerations.

### 3.3 Database Scalability
- **Read replicas** for:
  - Reporting queries
  - Schedule view service
  - Analytics dashboards
- **Partitioning strategy**:
  - Schedule tables partitioned by month
  - Audit logs partitioned by week
  - Archive completed jobs after 6 months
- **Write scaling**:
  - Schedule aggregate uses optimistic locking
  - Event sourcing for high-write aggregates
  - CQRS pattern separates read/write paths

### 3.4 Load Distribution
- API Gateway with rate limiting:
  - 100 requests/minute per user
  - 1000 requests/minute per service
- Load balancer with health checks
- Geographic distribution for global deployments

---

## 4. Resilience & Fault Tolerance

### 4.1 Retry & Idempotency
- All state-changing operations must be idempotent
- Unique request IDs prevent duplicate processing
- Retry strategy:
  - 3 attempts with exponential backoff
  - Maximum 30-second total retry time
  - Dead letter queue for failed messages

### 4.2 Circuit Breakers & Timeouts
- Service call timeouts:
  - Internal services: 5 seconds
  - External integrations: 10 seconds
- Circuit breaker opens after 5 consecutive failures
- Half-open state after 30 seconds
- Fallback strategies for each service dependency

### 4.3 Graceful Degradation
- If Assignment Service is slow:
  - Show cached assignments
  - Disable real-time conflict detection
  - Queue assignment requests
- If Station Management Service unavailable:
  - Use cached station data (with warning)
  - Prevent new station modifications
- If database read replica fails:
  - Fallback to primary (with increased latency)

### 4.4 Disaster Recovery
- RPO: 1 hour (database backups)
- RTO: 4 hours (full system restoration)
- Multi-AZ deployment for high availability
- Automated failover for critical services
- Runbooks for manual intervention scenarios

---

## 5. Operational Design

### 5.1 Monitoring & Observability
- **Metrics** (Prometheus format):
  - Request rates, error rates, latencies (RED metrics)
  - Resource utilization (CPU, memory, connections)
  - Business metrics (assignments/hour, conflicts detected)
- **Distributed Tracing**:
  - OpenTelemetry for cross-service requests
  - Correlation IDs in all log entries
  - End-to-end transaction visibility
- **Logging**:
  - Structured JSON logs
  - Log aggregation in ELK stack
  - Separate log levels by environment

### 5.2 Deployment Strategy
- **Blue-Green Deployment**:
  - Zero-downtime deployments
  - Quick rollback capability
  - Smoke tests on green environment
- **Feature Flags**:
  - Gradual rollout of new algorithms
  - A/B testing for UI changes
  - Kill switches for problematic features
- **Database Migrations**:
  - Forward-compatible changes only
  - Separate migration from code deployment
  - Automated rollback scripts

### 5.3 Performance Testing
- Load testing scenarios:
  - 10 concurrent schedulers managing assignments
  - 50 concurrent users viewing schedules and reports
  - 1,000 tasks scheduled per day
- Stress testing for peak periods
- Chaos engineering for resilience validation

---

## 6. Technology Stack Alignment

### 6.1 Symfony Considerations
- Use Symfony Messenger for async operations
- Doctrine ORM with performance optimizations
- API Platform for REST endpoints
- Symfony Cache for application caching

### 6.2 MariaDB Optimizations
- InnoDB for transactional consistency
- Proper index statistics maintenance
- Query cache for read-heavy operations
- Galera Cluster for HA (future consideration)

### 6.3 React Frontend Performance
- Code splitting by route
- Lazy loading of heavy components
- Virtual scrolling for large lists
- Optimistic UI updates
- Service Worker for offline capability

---

## 7. Cost Optimization

### 7.1 Resource Efficiency
- Auto-scaling based on actual load
- Spot instances for batch processing
- Reserved instances for baseline capacity
- Serverless for infrequent operations

### 7.2 Data Management
- Compress old audit and event logs
- Archive completed jobs to cold storage
- Purge unnecessary audit logs after retention
- Optimize image storage and delivery

---

## 8. Future Considerations

### 8.1 AI/ML Integration
- Infrastructure ready for optimization algorithms
- Data pipeline for training scheduling models
- A/B testing framework for algorithm comparison
- GPU support for intensive calculations

### 8.2 Multi-tenancy
- Tenant isolation at database level
- Per-tenant resource quotas
- Separate data encryption keys
- Tenant-specific customizations

### 8.3 Mobile Applications
- API design supports mobile clients
- Push notifications for assignments
- Offline mode with sync
- Reduced data transfer for mobile

---

## 9. Notes

- These design decisions directly influence implementation choices
- Regular review needed as system grows
- Performance benchmarks must be established early
- Security measures must be tested regularly
- All architectural decisions should be documented in ADRs
