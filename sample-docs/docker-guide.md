---
title: "Complete Docker Guide"
author: "DevOps Team"
category: "DevOps"
tags: ["docker", "containerization", "deployment"]
difficulty: "intermediate"
last_updated: "2024-01-15"
---

# Complete Docker Guide

Docker adalah platform containerization yang memungkinkan developer untuk package aplikasi beserta dependencies-nya ke dalam container yang portable dan lightweight.

## Apa itu Docker?

Docker menggunakan teknologi containerization untuk membuat, deploy, dan run aplikasi dalam environment yang isolated. Container berbeda dengan Virtual Machine karena lebih efisien dalam penggunaan resource.

### Keuntungan Docker:
- **Portability**: Run anywhere yang support Docker
- **Consistency**: Same environment dari development sampai production  
- **Efficiency**: Lebih ringan dibanding VM
- **Scalability**: Easy scaling dengan orchestration tools
- **Version Control**: Image versioning untuk easy rollback

## Docker Components

### 1. Docker Image
Image adalah template read-only yang berisi aplikasi dan dependencies. Image dibuild dari Dockerfile.

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 2. Docker Container
Container adalah running instance dari Docker image. Satu image bisa dijalankan sebagai multiple containers.

### 3. Dockerfile
Text file yang berisi instructions untuk build Docker image.

## Basic Docker Commands

### Image Management
```bash
# Build image dari Dockerfile
docker build -t my-app:latest .

# List images
docker images

# Remove image
docker rmi image-name

# Pull image dari registry
docker pull node:18-alpine

# Push image ke registry
docker push my-registry/my-app:latest
```

### Container Management
```bash
# Run container
docker run -d --name my-container -p 3000:3000 my-app:latest

# List running containers
docker ps

# List all containers
docker ps -a

# Stop container
docker stop my-container

# Remove container
docker rm my-container

# View logs
docker logs my-container

# Execute command dalam container
docker exec -it my-container /bin/bash
```

## Docker Compose

Docker Compose adalah tool untuk define dan run multi-container applications menggunakan YAML file.

### Example docker-compose.yml:
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Docker Compose Commands:
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Scale service
docker-compose up --scale web=3
```

## Docker Best Practices

### 1. Optimize Dockerfile
- Use multi-stage builds untuk reduce image size
- Minimize layers dengan combine commands
- Use .dockerignore untuk exclude unnecessary files
- Choose appropriate base image (alpine untuk smaller size)

### 2. Security Practices
- Don't run as root user
- Scan images untuk vulnerabilities
- Use specific tags instead of 'latest'
- Limit container resources

### Example Optimized Dockerfile:
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN chown -R nodeuser:nodejs /app
USER nodeuser
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues:

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   # Use different port
   docker run -p 3001:3000 my-app
   ```

2. **Container exits immediately**
   ```bash
   # Check logs untuk error messages
   docker logs container-name
   ```

3. **Permission denied**
   ```bash
   # Fix file permissions
   chmod +x script.sh
   # Or run as root (not recommended)
   docker run --user root my-app
   ```

## Docker Networking

### Network Types:
- **Bridge**: Default network untuk containers
- **Host**: Container menggunakan host network directly
- **None**: Disable networking
- **Custom**: User-defined networks

### Network Commands:
```bash
# Create network
docker network create my-network

# Connect container to network
docker network connect my-network my-container

# List networks
docker network ls
```

## Monitoring dan Logs

### Container Monitoring:
```bash
# Real-time resource usage
docker stats

# Container details
docker inspect my-container

# Process dalam container
docker exec my-container ps aux
```

## Production Considerations

### 1. Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### 2. Resource Limits
```bash
docker run --memory="512m" --cpus="1.0" my-app
```

### 3. Restart Policies
```bash
docker run --restart=always my-app
```

Docker adalah essential tool untuk modern application deployment. Dengan memahami concepts dan best practices ini, Anda bisa deploy aplikasi dengan efficient dan reliable.