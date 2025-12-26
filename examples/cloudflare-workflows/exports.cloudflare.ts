/**
 * Cloudflare Workflows Example
 *
 * This file demonstrates how to define Workflows in Nitro.
 * Workflows are durable, fault-tolerant execution environments.
 *
 * @see https://developers.cloudflare.com/workflows/
 */

// Example 1: Order Processing Workflow
// This workflow orchestrates a multi-step order processing pipeline
export class OrderProcessingWorkflow {
  async run(event: any, step: any) {
    // Step 1: Validate order
    const validatedOrder = await step.do("validate-order", async () => {
      console.log("Validating order:", event.orderId);
      return {
        orderId: event.orderId,
        valid: true,
        items: event.items || [],
      };
    });

    // Step 2: Process payment
    const paymentResult = await step.do("process-payment", async () => {
      console.log("Processing payment for order:", validatedOrder.orderId);
      return {
        success: true,
        transactionId: `txn_${Date.now()}`,
      };
    });

    // Step 3: Reserve inventory
    await step.do("reserve-inventory", async () => {
      console.log("Reserving inventory for order:", validatedOrder.orderId);
      return { reserved: true };
    });

    // Step 4: Send confirmation
    await step.do("send-confirmation", async () => {
      console.log("Sending confirmation for order:", validatedOrder.orderId);
      return { sent: true };
    });

    return {
      orderId: validatedOrder.orderId,
      status: "completed",
      transactionId: paymentResult.transactionId,
      completedAt: new Date().toISOString(),
    };
  }
}

// Example 2: Notification Workflow
// This workflow handles delayed and scheduled notifications
export class NotificationWorkflow {
  async run(event: any, step: any) {
    // Step 1: Prepare notification
    const notification = await step.do("prepare-notification", async () => {
      return {
        userId: event.userId,
        message: event.message,
        channel: event.channel || "email",
        preparedAt: Date.now(),
      };
    });

    // Step 2: Optional delay (workflows can sleep)
    if (event.delayMs) {
      await step.sleep("delay-notification", event.delayMs);
    }

    // Step 3: Send notification
    const result = await step.do("send-notification", async () => {
      console.log(
        `Sending ${notification.channel} notification to user:`,
        notification.userId
      );
      return {
        sent: true,
        sentAt: Date.now(),
      };
    });

    return {
      ...notification,
      ...result,
    };
  }
}
