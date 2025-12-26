/**
 * Cloudflare Containers Example - Durable Object Definition
 *
 * Containers connect to Durable Objects for state management.
 * This file defines the Durable Object that the container will interact with.
 */

import { DurableObject } from "cloudflare:workers";

/**
 * ProcessorDO - Example Durable Object for Container integration
 *
 * This Durable Object serves as the state management layer for
 * containerized workloads.
 */
export class ProcessorDO extends DurableObject {
  private processingQueue: Array<{
    id: string;
    data: any;
    status: string;
  }> = [];

  constructor(state: any, env: any) {
    super(state, env);
  }

  override async fetch(request: Request) {
    const url = new URL(request.url);

    // Handle different operations
    switch (url.pathname) {
      case "/process": {
        // Add a job to the processing queue
        const body = await request.json();
        const jobId = `job_${Date.now()}`;

        this.processingQueue.push({
          id: jobId,
          data: body,
          status: "queued",
        });

        return new Response(
          JSON.stringify({
            success: true,
            jobId,
            message: "Job queued for processing",
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      case "/status": {
        // Get the status of all jobs
        return new Response(
          JSON.stringify({
            queueLength: this.processingQueue.length,
            jobs: this.processingQueue,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      case "/complete": {
        // Mark a job as completed (called by the container)
        const body = (await request.json()) as { jobId: string };
        const job = this.processingQueue.find((j) => j.id === body.jobId);

        if (job) {
          job.status = "completed";
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Job marked as completed",
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      default: {
        return new Response("Not Found", { status: 404 });
      }
    }
  }

  /**
   * Optional: Alarm handler for scheduled processing
   * Containers can trigger alarms for periodic tasks
   */
  override async alarm() {
    console.log("Processing scheduled tasks...");

    // Process pending jobs
    const pendingJobs = this.processingQueue.filter(
      (job) => job.status === "queued"
    );

    for (const job of pendingJobs) {
      console.log(`Processing job: ${job.id}`);
      job.status = "processing";
      // Container would handle the actual processing
    }

    // Schedule next alarm (e.g., every 5 minutes)
    await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000);
  }
}
