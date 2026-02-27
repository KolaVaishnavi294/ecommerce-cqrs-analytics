import express from "express";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.READ_DATABASE_URL,
});

// ========= HEALTH CHECK ============

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// ========== PRODUCT SALES ===========

app.get("/api/analytics/products/:id/sales", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT product_id, total_quantity_sold, total_revenue, order_count
       FROM product_sales_view
       WHERE product_id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.json({
        productId: Number(req.params.id),
        totalQuantitySold: 0,
        totalRevenue: 0,
        orderCount: 0,
      });
    }

    const row = result.rows[0];

    res.json({
      productId: Number(row.product_id),
      totalQuantitySold: Number(row.total_quantity_sold),
      totalRevenue: parseFloat(row.total_revenue), // ✅ FIXED
      orderCount: Number(row.order_count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product sales" });
  }
});

// ========== CUSTOMER LIFETIME VALUE ===========

app.get("/api/analytics/customers/:id/lifetime-value", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT customer_id, total_spent, order_count, last_order_date
       FROM customer_ltv_view
       WHERE customer_id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.json({
        customerId: Number(req.params.id),
        totalSpent: 0,
        orderCount: 0,
        lastOrderDate: null,
      });
    }

    const row = result.rows[0];

    res.json({
      customerId: Number(row.customer_id),
      totalSpent: parseFloat(row.total_spent), // ✅ FIXED
      orderCount: Number(row.order_count),
      lastOrderDate: row.last_order_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch customer LTV" });
  }
});

// ========== CATEGORY METRICS ===========
// ⚠ Requirement expects: /api/analytics/categories/{category}/revenue

app.get("/api/analytics/categories/:name/revenue", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT category_name, total_revenue, total_orders
       FROM category_metrics_view
       WHERE category_name = $1`,
      [req.params.name]
    );

    if (result.rowCount === 0) {
      return res.json({
        category: req.params.name,
        totalRevenue: 0,
        totalOrders: 0,
      });
    }

    const row = result.rows[0];

    res.json({
      category: row.category_name,
      totalRevenue: parseFloat(row.total_revenue), // ✅ FIXED
      totalOrders: Number(row.total_orders),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch category metrics" });
  }
});

// ========== HOURLY SALES ===========

app.get("/api/analytics/hourly-sales", async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT hour_timestamp, total_orders, total_revenue
       FROM hourly_sales_view
       ORDER BY hour_timestamp DESC`
    );

    const formatted = result.rows.map((row) => ({
      hour_timestamp: row.hour_timestamp,
      total_orders: Number(row.total_orders),
      total_revenue: parseFloat(row.total_revenue), // ✅ FIXED
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hourly sales" });
  }
});

// ========== SYNC STATUS ===========

app.get("/api/analytics/sync-status", async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT last_processed_event_timestamp
       FROM sync_status
       WHERE id = 1`
    );

    if (result.rowCount === 0) {
      return res.json({
        lastProcessedEventTimestamp: null,
        lagSeconds: null,
      });
    }

    const lastTimestamp = result.rows[0].last_processed_event_timestamp;

    const lagSeconds = lastTimestamp
      ? Math.floor(
          (Date.now() - new Date(lastTimestamp).getTime()) / 1000
        )
      : null;

    res.json({
      lastProcessedEventTimestamp: lastTimestamp,
      lagSeconds: lagSeconds !== null ? Number(lagSeconds) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sync status" });
  }
});

// ========== START SERVER ===========

const PORT = process.env.QUERY_SERVICE_PORT || 8081;

app.listen(PORT, () => {
  console.log(`Query Service running on port ${PORT}`);
});