import express from "express";
import dotenv from "dotenv";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import amqp from "amqplib";

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let channel: amqp.Channel;

// ========== HEALTH CHECK ===========

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// ========== CREATE PRODUCT ===========

app.post("/api/products", async (req, res) => {
  const { name, category, price, stock } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, price, stock)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [name, category, price, stock]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating product");
  }
});

// ========== CREATE ORDER + OUTBOX ===========

app.post("/api/orders", async (req, res) => {
  const { customer_id, items } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let total = 0;
    const enrichedItems: any[] = [];

    for (const item of items) {
      const product = await client.query(
        "SELECT * FROM products WHERE id = $1",
        [item.product_id]
      );

      if (product.rowCount === 0) {
        throw new Error("Product not found");
      }

      const productData = product.rows[0];

      total += productData.price * item.quantity;

      enrichedItems.push({
        productId: productData.id,
        quantity: item.quantity,
        price: productData.price,
        category: productData.category  // ✅ VERY IMPORTANT
      });
    }

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, total, status)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [customer_id, total, "CREATED"]
    );

    const order = orderResult.rows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1,$2,$3,$4)`,
        [order.id, item.productId, item.quantity, item.price]
      );
    }

    // =========== EVENT PAYLOAD ===========
    const event = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      orderId: order.id,
      customerId: customer_id,
      items: enrichedItems,
      total
    };

    await client.query(
      `INSERT INTO outbox (id, topic, payload)
       VALUES ($1,$2,$3)`,
      [uuidv4(), "order-events", JSON.stringify(event)]
    );

    await client.query("COMMIT");

    res.json(order);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error creating order");
  } finally {
    client.release();
  }
});

// ========== OUTBOX PUBLISHER ===========

async function startOutboxPublisher() {
  const connection = await amqp.connect(process.env.BROKER_URL!);
  channel = await connection.createChannel();

  await channel.assertQueue("order-events", { durable: true });

  setInterval(async () => {
    try {
      const result = await pool.query(
        "SELECT * FROM outbox WHERE published_at IS NULL LIMIT 10"
      );

      for (const row of result.rows) {
        channel.sendToQueue(
          row.topic,
          Buffer.from(JSON.stringify(row.payload)),
          { persistent: true }
        );

        await pool.query(
          "UPDATE outbox SET published_at = NOW() WHERE id = $1",
          [row.id]
        );

        console.log("Published event:", row.id);
      }
    } catch (err) {
      console.error("Outbox publish error:", err);
    }
  }, 3000);
}

// ========= START SERVER ============

app.listen(8080, async () => {
  console.log("Command Service running on port 8080");
  await startOutboxPublisher();
});