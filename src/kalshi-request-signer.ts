/**
 * Kalshi Request Signing Utility
 * Handles RSA-PSS signing with proper timestamp handling
 */

import crypto from 'crypto';
import axios, { AxiosRequestConfig } from 'axios';

export interface SignedHeaders {
  'KALSHI-ACCESS-KEY': string;
  'KALSHI-ACCESS-SIGNATURE': string;
  'KALSHI-ACCESS-TIMESTAMP': string;
  [key: string]: string; // Allow index signature for axios
}

// Reconstructs a valid PEM key from potentially mangled input (e.g. Discord modal stripping newlines)
export function normalizePemKey(pem: string): string {
  pem = pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (pem.split('\n').length > 2) return pem; // Already has line breaks — looks fine

  const headerMatch = pem.match(/-----BEGIN [A-Z ]+-----/);
  const footerMatch = pem.match(/-----END [A-Z ]+-----/);
  if (!headerMatch || !footerMatch) return pem;

  const header = headerMatch[0];
  const footer = footerMatch[0];
  const base64 = pem.slice(pem.indexOf(header) + header.length, pem.lastIndexOf(footer)).replace(/\s/g, '');
  const chunks = base64.match(/.{1,64}/g) ?? [];
  return `${header}\n${chunks.join('\n')}\n${footer}`;
}

/**
 * Sign a Kalshi API request
 * @param method GET, POST, etc
 * @param apiPath e.g., /trade-api/v2/portfolio/balance
 * @param apiKey Your API Key
 * @param privateKey Your Private Key (PEM format)
 * @param body Optional request body for POST
 * @returns Signed headers ready for request
 */
export function signKalshiRequest(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT',
  apiPath: string,
  apiKey: string,
  privateKey: string,
  body?: Record<string, any> | null
): SignedHeaders {
  // IMPORTANT: Get fresh timestamp RIGHT BEFORE signing
  const timestampMs = Date.now();
  const timestampStr = timestampMs.toString();

  // Kalshi signing message: timestamp + METHOD + path (no body hash, strip query params)
  const pathWithoutQuery = apiPath.split('?')[0];
  const msgString = timestampStr + method + pathWithoutQuery;

  try {
    // Normalize the PEM key in case newlines were mangled by Discord modal input
    const normalizedKey = normalizePemKey(privateKey);

    // Create RSA-PSS signature
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(msgString);
    sign.end();

    const signature = sign.sign({
      key: normalizedKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });

    const signatureBase64 = signature.toString('base64');

    // Debug: log signing details (no private key content)
    console.log(`🔐 Signing: "${msgString}"`);
    console.log(`🔑 Key ID: ${apiKey}`);
    console.log(`📋 Key header: ${normalizedKey.split('\n')[0]}`);

    const headers: SignedHeaders = {
      'KALSHI-ACCESS-KEY': apiKey,
      'KALSHI-ACCESS-SIGNATURE': signatureBase64,
      'KALSHI-ACCESS-TIMESTAMP': timestampStr,
    };

    return headers;
  } catch (error) {
    console.error('❌ Error signing request:', error);
    throw new Error(`Failed to sign Kalshi request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function makeSignedGetRequest(
  apiPath: string,
  apiKey: string,
  privateKey: string,
  baseUrl: string
) {
  const headers = signKalshiRequest('GET', apiPath, apiKey, privateKey, null);

  try {
    const response = await axios.get(baseUrl + apiPath, { 
      headers,
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errBody = error.response?.data;
      console.error(`❌ Kalshi API ${error.response?.status} on ${apiPath}`);
      console.error('❌ Kalshi error body:', JSON.stringify(errBody, null, 2));
    } else {
      console.error('❌ Request error:', error);
    }
    throw error;
  }
}

/**
 * Make a signed POST request to Kalshi API
 */
export async function makeSignedPostRequest(
  apiPath: string,
  apiKey: string,
  privateKey: string,
  baseUrl: string,
  body: Record<string, any>
) {
  const headers = signKalshiRequest('POST', apiPath, apiKey, privateKey, body);

  try {
    console.log(`📤 POST ${baseUrl}${apiPath}`);
    const response = await axios.post(baseUrl + apiPath, body, {
      headers,
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ API Error: ${error.response?.status} - ${error.message}`);
      if (error.response?.data) {
        console.error('Response data:', error.response.data);
      }
    } else {
      console.error('❌ Request error:', error);
    }
    throw error;
  }
}
