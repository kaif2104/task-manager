# 🚀 Production-Grade DevSecOps 2-Server Environment on AWS EC2

A comprehensive, real-world DevSecOps hands-on architecture built on AWS EC2. This repository demonstrates automated multi-stage CI/CD pipelines, security gates (Gitleaks + SonarQube), Docker Hub image management, zero-downtime Blue/Green deployments, automated health checks, instant rollbacks, self-healing outage recovery, and real-time observability with Prometheus & Grafana.

---

## 🏗️ 2-Server Architecture Overview

```
                      +-------------------------------------------------------+
                      |                      AWS EC2                          |
                      +-------------------------------------------------------+
                                  |                               |
                                  v                               v
                  +-------------------------------+   +-------------------------------+
                  |  Server 1: CI/CD & Security   |   |  Server 2: Production Target  |
                  |  (13.235.106.204 / t3.large)  |   |   (43.205.12.10 / t3.large)   |
                  +-------------------------------+   +-------------------------------+
                  | - Jenkins LTS (Port 8080)     |   | - Nginx Reverse Proxy (Port 80|
                  | - SonarQube SAST (Port 9000)  |   | - PostgreSQL 15 DB (Port 5432)|
                  | - Gitleaks Secret Scanner     |   | - Blue App Target (Port 8081) |
                  | - Prometheus TSDB (Port 9090) |   | - Green App Target (Port 8082)|
                  | - Grafana Dashboards (Port 3000)  | - Self-Healing Cron Daemon   |
                  +-------------------------------+   +-------------------------------+
```

---

## 📌 Core Features & Objectives Achieved

### 1. DevSecOps CI/CD Pipeline (`Jenkinsfile`)
- **Multi-Stage Automated Pipeline:** Source code checkout from GitHub, automated security scanning, container builds, deployments, and automated testing.
- **Passwordless SSH Inter-Server Deployment:** Jenkins on Server 1 securely executes remote container controls and Nginx reloads on Server 2 via SSH keys (`server2-ssh-key`).

### 2. Security Gates & Static Code Analysis
- **Gitleaks Secret Detection:** Enforces security gates at Stage 2. Pipeline fails immediately if API keys, tokens, or hardcoded passwords are found in the repository.
- **SonarQube Code Analysis:** Performs Static Application Security Testing (SAST) on Stage 3, analyzing code quality, security hotspots, and bugs.

### 3. Registry & Production Image Management
- **Staging vs Production Tagging Strategy:** Every pipeline build builds and pushes a unique staging tag (`kaif03/todo:BUILD_NUMBER`) to Docker Hub.
- **Conditional `:latest` Promotion:** Image tag `:latest` is **only updated on Docker Hub after** post-deployment health checks pass on Server 2.

### 4. Zero-Downtime Blue/Green Deployment & Instant Rollback
- **Concurrent Staging Environments:** App runs in isolated containers — `app-blue` (Port `8081`) and `app-green` (Port `8082`).
- **Nginx Dynamic Traffic Switching:** Automated Nginx configuration update and zero-downtime reload (`sudo nginx -s reload`) in `< 100ms`.
- **Automated Health Validation:** Post-deployment validation of `/health` and `/ready` endpoints.
- **1-Second Automated Rollback:** If a deployed release fails health checks, Jenkins aborts the release and executes `/var/www/app/switch_traffic.sh` to keep production traffic safely on the healthy container target.

### 5. Automated Database Migration
- Executes PostgreSQL DDL scripts (`001_create_todos.sql`, `002_add_task_details.sql`) safely inside the target container using `npm run migrate` prior to routing public traffic.

### 6. Self-Healing Outage Recovery & Monitoring
- **Monitoring Daemon (`scripts/monitor_containers.sh`):** Evaluates live Nginx upstream targets, database status, and HTTP response codes every 60 seconds.
- **Automatic Incident Self-Healing:** Detects container crashes/stops (e.g. HTTP `502 Bad Gateway` / status `000`), logs critical alerts to `/var/log/app_monitor.log`, and automatically runs `docker start` to restore `HTTP 200 OK`.

### 7. Observability & Real-Time Monitoring (Prometheus + Grafana)
- Node.js `/metrics` integration via `prom-client`.
- **Prometheus (Port 9090):** Scrapes metric targets from Server 2 on 15s intervals.
- **Grafana (Port 3000):** Visualizes CPU Usage, Event Loop Lag, Process RAM, Active Request Concurrency, and V8 Heap Details in real-time.

---

## 🛠️ Repository File Structure

```text
.
├── src/
│   ├── server.js             # Express API Server with /health, /ready, & /metrics
│   ├── db.js                 # PostgreSQL Pool Connection
│   └── migrate.js            # Automated DDL Migration Runner
├── scripts/
│   ├── switch_traffic.sh     # Nginx Upstream Traffic Switcher (Blue/Green)
│   └── monitor_containers.sh # Production Self-Healing Monitoring Script
├── Dockerfile                # Container Build Spec (Node 18 Alpine)
├── Jenkinsfile               # Multi-Stage DevSecOps Pipeline Definition
├── sonar-project.properties  # SonarQube Scanner Configuration
└── package.json              # App Dependencies (express, pg, prom-client)
```

---

## 🚀 How to Replicate & Deploy

### Prerequisites
1. **Server 1 (CI/CD):** Ubuntu 24.04 EC2 (`t3.large`), Docker Engine, OpenJDK 21, Jenkins, SonarQube, Gitleaks, Prometheus, Grafana.
2. **Server 2 (Production):** Ubuntu 24.04 EC2 (`t3.large`), Docker Engine, Nginx, PostgreSQL 15.

### Step 1: Initialize Passwordless SSH
On Server 1:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
cat ~/.ssh/id_rsa.pub
```
Add public key to Server 2's `~/.ssh/authorized_keys`.

### Step 2: Configure Server 2 Nginx & Database
On Server 2:
```bash
# Launch PostgreSQL
docker run -d --name production-postgres -e POSTGRES_DB=tododb -e POSTGRES_USER=todouser -e POSTGRES_PASSWORD=todopassword -p 5432:5432 -v ~/postgres_data:/var/lib/postgresql/data --restart always postgres:15-alpine

# Install Nginx & setup scripts directory
sudo apt-get update && sudo apt-get install -y nginx
sudo mkdir -p /var/www/app
sudo chown -R ubuntu:ubuntu /var/www/app
```

### Step 3: Configure Jenkins Credentials
In Jenkins UI (`http://SERVER1_IP:8080`):
1. Add Secret Text: `sonar-token` (SonarQube API Token)
2. Add Username/Password: `docker-hub-credentials` (`kaif03`)
3. Add SSH Private Key: `server2-ssh-key` (Private key of Server 1)

### Step 4: Run the Pipeline
1. Create a Pipeline Job in Jenkins pointing to this Git repository.
2. Click **Build Now**!

---

## 📊 Observability Dashboards

| Component | Port | Dashboard / Endpoint |
| :--- | :--- | :--- |
| **Jenkins** | `8080` | `http://SERVER1_IP:8080` |
| **SonarQube** | `9000` | `http://SERVER1_IP:9000` |
| **Prometheus** | `9090` | `http://SERVER1_IP:9090/targets` |
| **Grafana** | `3000` | `http://SERVER1_IP:3000` |
| **Production App** | `80` | `http://SERVER2_IP/health` |

---

## 👤 Author
* **Mohammed Kaif Dudhwala** - Principal DevSecOps & Cloud Architect
* **Docker Hub:** [`kaif03/todo`](https://hub.docker.io/r/kaif03/todo)
