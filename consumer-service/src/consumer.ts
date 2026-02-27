import amqp from "amqplib";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.READ_DATABASE_URL,
});

async function startConsumer() {
  const connection = await amqp.connect(process.env.BROKER_URL!);
  const channel = await connection.createChannel();

  await channel.assertQueue("order-events", { durable: true });

  console.log("Consumer service started...");
  console.log("Waiting for events...");

  channel.consume("order-events", async (msg) => {
    if (!msg) return;

    const event = JSON.parse(msg.content.toString());

    const client = await pool.connect();   

    try {
      // Idempotency check
      const exists = await client.query(
        "SELECT 1 FROM processed_events WHERE event_id = $1",
        [event.eventId]
      );

      if ((exists.rowCount ?? 0) > 0) {
        channel.ack(msg);
        client.release();
        return;
      }

      await client.query("BEGIN");   //  BEGIN on SAME client

      // PRODUCT SALES
      for (const item of event.items) {
        await client.query(
          `
          INSERT INTO product_sales_view
          (product_id, total_quantity_sold, total_revenue, order_count)
          VALUES ($1, $2, $3, 1)
          ON CONFLICT (product_id)
          DO UPDATE SET
            total_quantity_sold = product_sales_view.total_quantity_sold + EXCLUDED.total_quantity_sold,
            total_revenue = product_sales_view.total_revenue + EXCLUDED.total_revenue,
            order_count = product_sales_view.order_count + 1
          `,
          [
            item.productId,
            item.quantity,
            item.quantity * item.price
          ]
        );

        // CATEGORY METRICS
        await client.query(
          `
          INSERT INTO category_metrics_view
          (category_name, total_revenue, total_orders)
          VALUES ($1, $2, 1)
          ON CONFLICT (category_name)
          DO UPDATE SET
            total_revenue = category_metrics_view.total_revenue + EXCLUDED.total_revenue,
            total_orders = category_metrics_view.total_orders + 1
          `,
          [item.category, item.quantity * item.price]
        );
      }

      // CUSTOMER LTV
      await client.query(
        `
        INSERT INTO customer_ltv_view
        (customer_id, total_spent, order_count, last_order_date)
        VALUES ($1, $2, 1, $3)
        ON CONFLICT (customer_id)
        DO UPDATE SET
          total_spent = customer_ltv_view.total_spent + EXCLUDED.total_spent,
          order_count = customer_ltv_view.order_count + 1,
          last_order_date = EXCLUDED.last_order_date
        `,
        [event.customerId, event.total, event.timestamp]
      );

      // HOURLY SALES
      const hour = new Date(event.timestamp);
      hour.setMinutes(0, 0, 0);

      await client.query(
        `
        INSERT INTO hourly_sales_view
        (hour_timestamp, total_orders, total_revenue)
        VALUES ($1, 1, $2)
        ON CONFLICT (hour_timestamp)
        DO UPDATE SET
          total_orders = hourly_sales_view.total_orders + 1,
          total_revenue = hourly_sales_view.total_revenue + EXCLUDED.total_revenue
        `,
        [hour, event.total]
      );

      // Mark event processed
      await client.query(
        "INSERT INTO processed_events (event_id) VALUES ($1)",
        [event.eventId]
      );

      // Sync status
      await client.query(
        `
        INSERT INTO sync_status (id, last_processed_event_timestamp)
        VALUES (1, $1)
        ON CONFLICT (id)
        DO UPDATE SET
          last_processed_event_timestamp = EXCLUDED.last_processed_event_timestamp
        `,
        [event.timestamp]
      );

      await client.query("COMMIT");   //  COMMIT on SAME client

      channel.ack(msg);
      console.log("Processed event:", event.eventId);

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error processing event:", err);
      channel.nack(msg);
    } finally {
      client.release();   //  release connection
    }
  });
}

startConsumer();