import type { NextApiRequest, NextApiResponse } from 'next';
import { Webhook, WebhookEvent } from 'svix';
import { buffer } from 'micro';

// IMPORTANT: Disable Next.js's default body parsing for this route.
// The raw body is required by Svix for signature verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Ensure this environment variable is set in your .env.local file or deployment configuration.
// Example: POLAR_WEBHOOK_SECRET=whsec_your_secret_from_polar_dashboard
const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

/**
 * Helper function to safely extract a single header value from NextApiRequest's headers.
 * Handles cases where the header might be undefined, a single string, or an array of strings.
 * For webhook headers, it's typically a single string, but this adds robustness.
 */
const getHeader = (headers: NextApiRequest['headers'], key: string): string | undefined => {
  const value = headers[key];
  if (Array.isArray(value)) {
    return value[0]; // If it's an array, take the first value as the primary
  }
  return value as string | undefined; // Otherwise, return as string or undefined
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only allow POST requests for webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Ensure the webhook secret is configured
  if (!WEBHOOK_SECRET) {
    // In a production environment, this error should be logged to an observability platform (e.g., Sentry, DataDog).
    // Avoid exposing detailed internal configuration errors to the client directly.
    return res.status(500).json({ message: 'Server configuration error: Webhook secret not found.' });
  }

  // Get the raw request body. This is crucial as Svix requires the exact raw payload for verification.
  const payload = (await buffer(req)).toString();
  const headers = req.headers;

  // As per core lesson, Polar.sh webhooks follow the Svix standard and use 'webhook-signature'.
  // The Svix library expects specific header names for verification: 'svix-id', 'svix-timestamp', 'svix-signature'.
  // We extract the incoming headers using our robust helper and map 'webhook-signature' to 'svix-signature'
  // when passing to the Svix library's verify method.
  const svixId = getHeader(headers, 'svix-id');
  const svixTimestamp = getHeader(headers, 'svix-timestamp');
  const polarSignature = getHeader(headers, 'webhook-signature'); // This is the header Polar.sh sends per core lesson

  // Validate that all required Svix headers are present
  if (!svixId || !svixTimestamp || !polarSignature) {
    return res.status(400).json({ message: 'Missing required webhook headers for verification.' });
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  let msg: WebhookEvent;
  try {
    // Verify the webhook signature using the Svix library
    msg = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': polarSignature, // Map Polar's 'webhook-signature' to Svix's expected 'svix-signature'
    }) as WebhookEvent;
  } catch (err: unknown) {
    let errorMessage = 'Unknown webhook verification error';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    // Log verification failures (e.g., invalid signature, expired timestamp) for security monitoring.
    return res.status(400).json({ message: 'Webhook verification failed', error: errorMessage });
  }

  // If verification is successful, proceed to process the event
  try {
    switch (msg.type) {
      case 'pledge.created':
        // Example: Trigger an action when a new pledge is created.
        // This could involve updating a database, sending notifications, or queuing a background job.
        // await handlePledgeCreated(msg.data);
        break;
      case 'issue.created':
        // Example: Handle new issue creation events related to funding campaigns.
        // await handleIssueCreated(msg.data);
        break;
      case 'pledge.updated':
        // Example: Handle changes to a pledge (e.g., amount, status).
        // await handlePledgeUpdated(msg.data);
        break;
      case 'pledge.disputed':
        // Example: Handle events where a pledge is disputed.
        // await handlePledgeDisputed(msg.data);
        break;
      // Add more cases for other Polar event types as your application requires.
      // Refer to Polar.sh documentation for a full list of event types.
      default:
        // Optionally log unhandled event types for future development or monitoring,
        // but still return a 200 OK to acknowledge receipt of the webhook.
        break;
    }

    // Acknowledge successful processing of the webhook
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error: unknown) {
    let errorMessage = 'Unknown error processing webhook event';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    // This catch block handles errors *within our application logic* after successful webhook verification.
    // Such errors are critical and should be logged to an observability platform for immediate investigation.
    return res.status(500).json({ message: 'Error processing webhook event', error: errorMessage });
  }
}