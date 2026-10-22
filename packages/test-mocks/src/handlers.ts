/**
 * MSW request handlers for Stellar RPC mocking
 */

import {
  createGetEventsResponse,
  createGetLedgerResponse,
  createSimulateTransactionResponse,
} from './factories';
import { RpcResponseFactoryOptions } from './types';

/**
 * Mock handler for Stellar RPC getEvents endpoint
 */
export function mockGetEventsHandler(
  options?: RpcResponseFactoryOptions
) {
  return (req: any, res: any, ctx: any) => {
    const response = createGetEventsResponse(options);
    return res(ctx.json(response));
  };
}

/**
 * Mock handler for Stellar RPC getLedger endpoint
 */
export function mockGetLedgerHandler(
  options?: RpcResponseFactoryOptions
) {
  return (req: any, res: any, ctx: any) => {
    const response = createGetLedgerResponse(options);
    return res(ctx.json(response));
  };
}

/**
 * Mock handler for Stellar RPC simulateTransaction endpoint
 */
export function mockSimulateTransactionHandler(
  options?: RpcResponseFactoryOptions
) {
  return (req: any, res: any, ctx: any) => {
    const response = createSimulateTransactionResponse(options);
    return res(ctx.json(response));
  };
}

/**
 * Create a complete set of Stellar RPC mock handlers
 */
export function createStellarRpcHandlers(
  baseUrl: string = 'http://localhost:8000',
  options?: RpcResponseFactoryOptions
) {
  return [
    {
      method: 'post',
      url: `${baseUrl}/rpc`,
      handler: (req: any, res: any, ctx: any) => {
        const { method } = req.body || {};

        if (method === 'getEvents') {
          return res(ctx.json(createGetEventsResponse(options)));
        }

        if (method === 'getLedger') {
          return res(ctx.json(createGetLedgerResponse(options)));
        }

        if (method === 'simulateTransaction') {
          return res(ctx.json(createSimulateTransactionResponse(options)));
        }

        // Default response for unknown methods
        return res(
          ctx.status(400),
          ctx.json({ error: `Unknown method: ${method}` })
        );
      },
    },
  ];
}
