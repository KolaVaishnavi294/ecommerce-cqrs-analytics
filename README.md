# 🛒 E-Commerce CQRS & Event-Driven Analytics System

## 📌 Overview

This project implements a high-performance e-commerce analytics backend using:

- CQRS (Command Query Responsibility Segregation)

- Event-Driven Architecture (EDA)

- Transactional Outbox Pattern

- RabbitMQ Message Broker

- PostgreSQL (Write & Read Databases)

- Docker Compose for full container orchestration

The system separates write operations from read operations and maintains denormalized materialized views for fast analytics queries.

This architecture demonstrates scalable, resilient, and distributed backend system design used in real-world e-commerce platforms.

---

## 🏗 Architecture

### Write Side (Command Model)

- Handles product and order creation

- Stores normalized transactional data

- Writes domain events to an outbox table

- Publishes events asynchronously to RabbitMQ

- Ensures atomicity using DB transactions

### 🔹 Event Layer

- RabbitMQ used for asynchronous communication

- Outbox publisher guarantees reliable event delivery

- At-least-once delivery semantics

### 🔹 Read Side (Query Model)

- Consumer listens to events

- Updates denormalized materialized views:

    - product_sales_view

    - category_metrics_view

    - customer_ltv_view

    - hourly_sales_view

- Maintains sync_status table for tracking eventual consistency lag

---

## 📊 System Architecture Diagram
```bash
Client
   |
   v
Command Service (8080)
   |
   |  (Write DB + Outbox)
   v
RabbitMQ
   |
   v
Consumer Service
   |
   v
Read DB (Materialized Views)
   |
   v
Query Service (8081)
```

---

## 📂 Project Structure
```bash
ecommerce-cqrs-analytics/
│
├── command-service/
├── consumer-service/
├── query-service/
├── docker-compose.yml
├── .env.example
├── submission.json
└── README.md
```

---

## 🚀 How to Run

### 1️⃣ Clone Repository

```bash
git clone https://github.com/KolaVaishnavi294/ecommerce-cqrs-analytics.git
cd ecommerce-cqrs-analytics
```
### 2️⃣ Start System
```bash
docker compose up --build
```
All services will start automatically with health checks.

---

## 🔌 Services & Ports
| Service         | Port  |
| --------------- | ----- |
| Command Service | 8080  |
| Query Service   | 8081  |
| RabbitMQ UI     | 15672 |
| Write Database  | 5432  |
| Read Database   | 5433  |

---

## 📦 API Endpoints
### 🔹 Command Service (Write – Port 8080)
#### Create Product
```bash
POST /api/products
```
Request:
```bash
{
  "name": "iPhone 15",
  "category": "Electronics",
  "price": 80000,
  "stock": 10
}
```

#### Create Order
```bash
POST /api/orders
```
Request:
```bash
{
  "customerId": 101,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "price": 80000
    }
  ]
}
```

### 🔹 Query Service (Read – Port 8081)
#### Product Sales
```bash
GET /api/analytics/products/{productId}/sales
```
#### Category Revenue
```bash
GET /api/analytics/categories/{category}/revenue
```
#### Customer Lifetime Value
```bash
GET /api/analytics/customers/{customerId}/lifetime-value
```
#### Hourly Sales
```bash
GET /api/analytics/hourly-sales
```
#### Sync Status (Eventual Consistency Monitor)
```bash
GET /api/analytics/sync-status
```
example Response for sync status:
```bash
{
  "lastProcessedEventTimestamp": "2026-02-26T09:19:24.022Z",
  "lagSeconds": 2
}
```

---

## 🧠 Key Design Patterns Implemented
### ✅ CQRS

- Write database optimized for transactions

- Read database optimized for analytics queries

- Clear separation of responsibilities

### ✅ Transactional Outbox Pattern

- Order + Event written in same DB transaction

- Prevents dual-write inconsistency

- Ensures reliable event publishing

### ✅ Event-Driven Architecture

- RabbitMQ handles asynchronous communication

- Loose coupling between services

### ✅ Idempotent Consumer

- processed_events table prevents duplicate event processing

- Safe for at-least-once message delivery

### ✅ Eventual Consistency

- Read model updated asynchronously

- sync_status endpoint exposes processing lag

---

## 🧪 Testing Eventual Consistency

- Create product

- Create order

- Immediately call analytics endpoint (may not reflect yet)

- Wait 5–10 seconds

- Call analytics again → view updated

---

## 📌 Conclusion

This system demonstrates:

- Scalable backend architecture

- Proper CQRS separation

- Reliable event publishing

- Idempotent event processing

- Eventual consistency handling

- Production-style container orchestration

It reflects real-world distributed system design principles used in modern e-commerce platforms.