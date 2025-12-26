/**
 * Example API routes demonstrating Workflow usage
 *
 * These routes show how to interact with Workflows from your Nitro application.
 */

import {
  createError,
  defineEventHandler,
  getQuery,
  getRouterParam,
  readBody,
} from "h3";

export default defineEventHandler(async (event) => {
  const action = getRouterParam(event, "action");

  // Access Cloudflare environment bindings
  const env = (event.context as any).cloudflare?.env;

  if (!env) {
    throw createError({
      statusCode: 500,
      message: "Cloudflare environment not available",
    });
  }

  switch (action) {
    case "create-order": {
      // Trigger the Order Processing Workflow
      const body = (await readBody(event)) as any;

      // Create a new workflow instance
      const instance = await env.ORDER_WORKFLOW.create({
        params: {
          orderId: body.orderId,
          items: body.items,
        },
      });

      return {
        success: true,
        instanceId: instance.id,
        message: "Order workflow started",
      };
    }

    case "send-notification": {
      // Trigger the Notification Workflow
      const body = (await readBody(event)) as any;

      // Create a notification workflow instance
      const instance = await env.NOTIFICATION_WORKFLOW.create({
        params: {
          userId: body.userId,
          message: body.message,
          channel: body.channel,
          delayMs: body.delayMs,
        },
      });

      return {
        success: true,
        instanceId: instance.id,
        message: "Notification workflow started",
      };
    }

    case "get-status": {
      const { workflowId } = getQuery(event);

      if (!workflowId) {
        throw createError({
          statusCode: 400,
          message: "workflowId query parameter required",
        });
      }

      // Get workflow status
      const instance = await env.ORDER_WORKFLOW.get(workflowId);
      const status = await instance.status();

      return {
        workflowId,
        status,
      };
    }

    default: {
      throw createError({
        statusCode: 404,
        message: `Unknown action: ${action}`,
      });
    }
  }
});
