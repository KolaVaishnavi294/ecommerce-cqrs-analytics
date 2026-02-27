CREATE TABLE product_sales_view (
    product_id INTEGER PRIMARY KEY,
    total_quantity_sold INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE category_metrics_view (
    category_name VARCHAR(255) PRIMARY KEY,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0
);

CREATE TABLE customer_ltv_view (
    customer_id INTEGER PRIMARY KEY,
    total_spent NUMERIC(12,2) DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    last_order_date TIMESTAMP
);

CREATE TABLE hourly_sales_view (
    hour_timestamp TIMESTAMP PRIMARY KEY,
    total_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_processed_event_timestamp TIMESTAMP
);

CREATE INDEX idx_product_sales_product ON product_sales_view(product_id);
CREATE INDEX idx_customer_ltv_customer ON customer_ltv_view(customer_id);