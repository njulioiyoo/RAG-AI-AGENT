---
title: "Microservices Architecture Guide"
author: "Architecture Team"
category: "Software Architecture"
tags: ["microservices", "architecture", "scalability", "distributed systems"]
difficulty: "advanced"
last_updated: "2024-01-20"
---

# Microservices Architecture Guide

Microservices architecture adalah pendekatan untuk developing software application sebagai suite dari independent services yang communicate over well-defined APIs. Setiap service dapat di-deploy, scale, dan maintain secara independent.

## Apa itu Microservices?

Microservices memecah large application menjadi small, independent services yang masing-masing memiliki:
- **Single Responsibility**: Setiap service fokus pada satu business capability
- **Autonomous**: Dapat di-develop dan deploy independent
- **Decentralized**: Own data dan business logic
- **Fault Isolated**: Failure di satu service tidak mempengaruhi others

### Microservices vs Monolith

| Aspect | Monolith | Microservices |
|--------|----------|---------------|
| **Deployment** | Single unit | Independent services |
| **Scaling** | Scale entire app | Scale individual services |
| **Technology** | Single tech stack | Multiple tech stacks possible |
| **Development** | Single team | Multiple teams |
| **Failure** | Single point of failure | Isolated failures |

## Benefits of Microservices

### 1. Scalability
```
High Traffic Service ─→ Scale only that service
Low Traffic Service ─→ Keep minimal resources
```

### 2. Technology Diversity
```
User Service ─→ Node.js + MongoDB
Payment Service ─→ Java + PostgreSQL  
Analytics Service ─→ Python + BigQuery
```

### 3. Team Independence
- Different teams dapat work pada different services
- Independent release cycles
- Technology choices per team expertise

### 4. Fault Tolerance
- Failure di satu service tidak crash entire system
- Circuit breaker patterns untuk prevent cascade failures

## Microservices Patterns

### 1. Database per Service Pattern
```
User Service ─→ User Database
Order Service ─→ Order Database
Payment Service ─→ Payment Database
```

Setiap service memiliki own database untuk ensure loose coupling.

### 2. API Gateway Pattern
```
Client ─→ API Gateway ─→ [Service A, Service B, Service C]
```

API Gateway sebagai single entry point yang handle:
- Routing requests ke appropriate services
- Authentication & authorization
- Rate limiting
- Load balancing

### 3. Event-Driven Architecture
```
Order Service ─→ Order Created Event ─→ [Email Service, Inventory Service]
```

Services communicate melalui events instead of direct calls.

### 4. Circuit Breaker Pattern
```javascript
class CircuitBreaker {
    constructor(timeout, failureThreshold, recoveryTimeout) {
        this.timeout = timeout;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.state = 'CLOSED';
        this.failureCount = 0;
    }

    async call(operation) {
        if (this.state === 'OPEN') {
            throw new Error('Circuit breaker is OPEN');
        }
        
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
}
```

## Communication Patterns

### 1. Synchronous Communication (HTTP/REST)
```javascript
// API call antar services
const userService = {
    async getUser(userId) {
        const response = await fetch(`http://user-service/users/${userId}`);
        return response.json();
    }
};

// Dengan service discovery
const userService = {
    async getUser(userId) {
        const serviceUrl = await serviceRegistry.discover('user-service');
        const response = await fetch(`${serviceUrl}/users/${userId}`);
        return response.json();
    }
};
```

### 2. Asynchronous Communication (Message Queue)
```javascript
// Publisher (Order Service)
const orderCreated = {
    orderId: '12345',
    userId: 'user123',
    items: [...]
};
messageQueue.publish('order.created', orderCreated);

// Subscriber (Email Service)
messageQueue.subscribe('order.created', async (orderData) => {
    await sendOrderConfirmationEmail(orderData);
});
```

### 3. Event Sourcing
```javascript
// Store events instead of current state
const events = [
    {type: 'UserCreated', userId: '123', name: 'John'},
    {type: 'UserEmailUpdated', userId: '123', email: 'john@new.com'},
    {type: 'UserActivated', userId: '123'}
];

// Rebuild state from events
function getCurrentUser(userId, events) {
    return events
        .filter(event => event.userId === userId)
        .reduce((user, event) => applyEvent(user, event), {});
}
```

## Implementation Example

### Service Structure
```
my-ecommerce/
├── services/
│   ├── user-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── product-service/
│   ├── order-service/
│   └── payment-service/
├── api-gateway/
├── shared/
│   ├── events/
│   └── libraries/
└── docker-compose.yml
```

### User Service Example
```javascript
// user-service/src/app.js
const express = require('express');
const app = express();

app.get('/users/:id', async (req, res) => {
    try {
        const user = await userRepository.findById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.post('/users', async (req, res) => {
    try {
        const user = await userRepository.create(req.body);
        
        // Publish event
        eventBus.publish('user.created', {
            userId: user.id,
            email: user.email,
            name: user.name
        });
        
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({error: error.message});
    }
});

app.listen(3001);
```

### API Gateway Example
```javascript
// api-gateway/src/app.js
const express = require('express');
const httpProxy = require('http-proxy-middleware');

const app = express();

// Route ke user service
app.use('/api/users', httpProxy({
    target: 'http://user-service:3001',
    changeOrigin: true,
    pathRewrite: {
        '^/api/users': '/users'
    }
}));

// Route ke product service  
app.use('/api/products', httpProxy({
    target: 'http://product-service:3002',
    changeOrigin: true,
    pathRewrite: {
        '^/api/products': '/products'
    }
}));

app.listen(3000);
```

### Docker Compose Setup
```yaml
version: '3.8'
services:
  api-gateway:
    build: ./api-gateway
    ports:
      - "3000:3000"
    depends_on:
      - user-service
      - product-service

  user-service:
    build: ./services/user-service
    environment:
      - DB_URL=mongodb://user-db:27017/users
    depends_on:
      - user-db

  user-db:
    image: mongo:latest
    volumes:
      - user_data:/data/db

  product-service:
    build: ./services/product-service
    environment:
      - DB_URL=postgresql://postgres:password@product-db:5432/products

  product-db:
    image: postgres:15
    environment:
      POSTGRES_DB: products
      POSTGRES_PASSWORD: password

volumes:
  user_data:
```

## Data Management

### 1. Database per Service
```sql
-- User Service Database
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE,
    name VARCHAR,
    created_at TIMESTAMP
);

-- Order Service Database  
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID,  -- Reference ke User Service
    status VARCHAR,
    created_at TIMESTAMP
);
```

### 2. Saga Pattern untuk Distributed Transactions
```javascript
// Order Saga
class OrderSaga {
    async execute(orderData) {
        try {
            // Step 1: Reserve inventory
            await inventoryService.reserve(orderData.items);
            
            // Step 2: Process payment
            await paymentService.charge(orderData.payment);
            
            // Step 3: Create order
            await orderService.create(orderData);
            
            return {success: true, orderId: orderData.id};
        } catch (error) {
            // Compensation actions
            await this.compensate(orderData, error);
            throw error;
        }
    }
    
    async compensate(orderData, error) {
        // Rollback in reverse order
        await orderService.cancel(orderData.id);
        await paymentService.refund(orderData.payment);
        await inventoryService.release(orderData.items);
    }
}
```

## Monitoring dan Observability

### 1. Distributed Tracing
```javascript
const opentelemetry = require('@opentelemetry/api');
const tracer = opentelemetry.trace.getTracer('user-service');

app.get('/users/:id', async (req, res) => {
    const span = tracer.startSpan('get_user');
    
    try {
        span.setAttributes({
            'user.id': req.params.id,
            'service.name': 'user-service'
        });
        
        const user = await userRepository.findById(req.params.id);
        span.setStatus({code: opentelemetry.SpanStatusCode.OK});
        res.json(user);
    } catch (error) {
        span.recordException(error);
        span.setStatus({code: opentelemetry.SpanStatusCode.ERROR});
        throw error;
    } finally {
        span.end();
    }
});
```

### 2. Health Checks
```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
            database: await checkDatabase(),
            dependencies: await checkDependencies()
        }
    };
    
    const isHealthy = Object.values(health.checks).every(check => check.status === 'up');
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json(health);
});
```

## Testing Strategies

### 1. Unit Testing (per service)
```javascript
// user-service.test.js
describe('User Service', () => {
    test('should create user', async () => {
        const userData = {name: 'John', email: 'john@test.com'};
        const user = await userService.createUser(userData);
        
        expect(user.id).toBeDefined();
        expect(user.name).toBe(userData.name);
    });
});
```

### 2. Integration Testing
```javascript
// integration.test.js  
describe('User Service Integration', () => {
    test('should create user and publish event', async () => {
        const userData = {name: 'John', email: 'john@test.com'};
        
        // Mock event bus
        const eventSpy = jest.spyOn(eventBus, 'publish');
        
        await request(app)
            .post('/users')
            .send(userData)
            .expect(201);
            
        expect(eventSpy).toHaveBeenCalledWith('user.created', 
            expect.objectContaining({email: userData.email})
        );
    });
});
```

### 3. Contract Testing
```javascript
// user-service.contract.js
const {Pact} = require('@pact-foundation/pact');

const provider = new Pact({
    consumer: 'order-service',
    provider: 'user-service'
});

describe('User Service Contract', () => {
    test('should get user by id', async () => {
        await provider
            .given('user exists')
            .uponReceiving('get user request')
            .withRequest({
                method: 'GET',
                path: '/users/123'
            })
            .willRespondWith({
                status: 200,
                body: {
                    id: '123',
                    name: 'John Doe'
                }
            });
    });
});
```

## Security Considerations

### 1. Service-to-Service Authentication
```javascript
// JWT token untuk internal communication
const jwt = require('jsonwebtoken');

function generateServiceToken(serviceName) {
    return jwt.sign(
        {service: serviceName, iat: Date.now()},
        process.env.SERVICE_SECRET,
        {expiresIn: '1h'}
    );
}

function verifyServiceToken(req, res, next) {
    const token = req.headers['x-service-token'];
    
    try {
        const decoded = jwt.verify(token, process.env.SERVICE_SECRET);
        req.serviceContext = decoded;
        next();
    } catch (error) {
        res.status(401).json({error: 'Invalid service token'});
    }
}
```

### 2. API Gateway Security
```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Challenges dan Solutions

### 1. Network Latency
**Problem**: Multiple network calls increase latency
**Solution**: 
- Use caching strategically
- Implement async communication where possible
- Optimize network calls dengan batching

### 2. Data Consistency
**Problem**: Distributed data dapat menjadi inconsistent
**Solution**:
- Eventually consistent design
- Saga pattern untuk distributed transactions
- Event sourcing untuk audit trail

### 3. Service Discovery
**Problem**: Services perlu tahu location dari other services
**Solution**:
```javascript
// Service registry
const serviceRegistry = {
    services: new Map(),
    
    register(serviceName, serviceUrl, healthCheckUrl) {
        this.services.set(serviceName, {
            url: serviceUrl,
            healthCheck: healthCheckUrl,
            lastSeen: Date.now()
        });
    },
    
    discover(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service ${serviceName} not found`);
        }
        return service.url;
    }
};
```

## Best Practices

1. **Start with Monolith**: Evolve to microservices ketika needed
2. **Domain-Driven Design**: Align services dengan business domains
3. **Automation**: Automate deployment, testing, monitoring
4. **Documentation**: Maintain good API documentation
5. **Gradual Migration**: Migrate incrementally from monolith

Microservices architecture memberikan flexibility dan scalability, tapi juga introduces complexity. Pastikan team punya expertise dan tools yang tepat sebelum adopting microservices.