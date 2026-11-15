import crypto from 'crypto';
import { config } from '../config/env.js';

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export class PaystackService {
  private secretKey: string;

  constructor(secretKey: string = config.paystackSecretKey) {
    this.secretKey = secretKey;
  }

  setSecretKey(key: string) {
    this.secretKey = key;
  }

  async initializeTransaction(params: {
    email: string;
    amount: number; // in lowest currency unit (kobo/cents)
    reference: string;
    callbackUrl?: string;
  }): Promise<PaystackInitResponse> {
    // If running in test suite with mock key or offline flag, return mock response
    if (this.secretKey === 'sk_test_mock' || process.env.MOCK_PAYSTACK === 'true') {
      return {
        authorization_url: `https://checkout.paystack.com/test-mock-${params.reference}`,
        access_code: `mock_code_${params.reference}`,
        reference: params.reference,
      };
    }

    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        callback_url: params.callbackUrl || `${config.frontendUrl}/orders/return?reference=${params.reference}`,
      }),
    });

    const data: any = await response.json();

    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Failed to initialize Paystack transaction');
    }

    return {
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    };
  }

  verifySignature(rawBody: Buffer | string, signatureHeader?: string | string[]): boolean {
    if (!signatureHeader || !this.secretKey) {
      return false;
    }

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    // Allow simulated webhook in local dev/mock mode
    if (
      (this.secretKey === 'sk_test_mock' || process.env.NODE_ENV !== 'production') &&
      signature === 'simulated_dev_webhook'
    ) {
      return true;
    }

    const hmac = crypto.createHmac('sha512', this.secretKey);
    hmac.update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    const expectedSignature = hmac.digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    // timingSafeEqual requires buffers of identical byteLength; if lengths differ, signature is invalid
    if (sigBuffer.byteLength !== expectedBuffer.byteLength) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }
}

export const paystackService = new PaystackService();
