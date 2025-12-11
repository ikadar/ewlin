-- ===========================================
-- Flux Print Shop Scheduling System
-- Database Initialization Script
-- ===========================================
-- This script runs automatically on first container start
-- when the data volume is empty.

-- Create additional schemas if needed (main database created by env vars)

-- Station Management schema (for future use)
-- CREATE SCHEMA IF NOT EXISTS station_management;

-- Job Management schema (for future use)
-- CREATE SCHEMA IF NOT EXISTS job_management;

-- Assignment schema (for future use)
-- CREATE SCHEMA IF NOT EXISTS assignment;

-- Scheduling View schema (for future use)
-- CREATE SCHEMA IF NOT EXISTS scheduling_view;

-- Grant privileges to application user
-- (Already done by MARIADB_USER env var, but explicit for clarity)
GRANT ALL PRIVILEGES ON `flux_scheduler`.* TO 'flux_user'@'%';
FLUSH PRIVILEGES;

-- Verify setup
SELECT 'Database initialization complete' AS status;
