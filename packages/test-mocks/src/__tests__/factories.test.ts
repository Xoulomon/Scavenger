import { describe, it, expect } from 'vitest';
import {
  createGetEventsResponse,
  createGetLedgerResponse,
  createSimulateTransactionResponse,
  createStellarEvent,
  createWasteRegisteredEvent,
  createParticipantRegisteredEvent,
  createWasteTransferredEvent,
  createTokensRewardedEvent,
  createEventsBatchResponse,
} from '../factories';

describe('Stellar RPC Mock Factories', () => {
  describe('createStellarEvent', () => {
    it('creates event with default values', () => {
      const event = createStellarEvent();

      expect(event).toHaveProperty('type', 'contract');
      expect(event).toHaveProperty('contractId');
      expect(event).toHaveProperty('topic');
      expect(event).toHaveProperty('value');
      expect(event.inSuccessfulTransaction).toBe(true);
    });

    it('allows overriding event properties', () => {
      const customTopic = ['custom', 'event'];
      const event = createStellarEvent({
        topic: customTopic,
        type: 'system',
      });

      expect(event.topic).toEqual(customTopic);
      expect(event.type).toBe('system');
    });
  });

  describe('createGetEventsResponse', () => {
    it('creates response with default values', () => {
      const response = createGetEventsResponse();

      expect(response.events).toHaveLength(1);
      expect(response).toHaveProperty('latestLedger');
      expect(response).toHaveProperty('latestLedgerCloseTime');
    });

    it('creates multiple events when specified', () => {
      const response = createGetEventsResponse({ eventCount: 5 });

      expect(response.events).toHaveLength(5);
      response.events.forEach((event, index) => {
        expect(event.id).toBe(`${event.ledger}-${index}`);
      });
    });

    it('accepts custom ledger and timestamp', () => {
      const customLedger = 75000;
      const customTimestamp = '2024-02-01T12:00:00Z';

      const response = createGetEventsResponse({
        ledger: customLedger,
        timestamp: customTimestamp,
      });

      expect(response.ledger).toBe(customLedger);
      expect(response.latestLedger).toBe(customLedger);
    });
  });

  describe('createGetLedgerResponse', () => {
    it('creates ledger response with valid structure', () => {
      const response = createGetLedgerResponse();

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('hash');
      expect(response).toHaveProperty('prevHash');
      expect(response).toHaveProperty('sequence');
      expect(response).toHaveProperty('successfulTransactionCount');
      expect(response).toHaveProperty('operationCount');
    });

    it('sets sequence to ledger number', () => {
      const customLedger = 75000;
      const response = createGetLedgerResponse({ ledger: customLedger });

      expect(response.sequence).toBe(customLedger);
    });
  });

  describe('createSimulateTransactionResponse', () => {
    it('creates simulation response with valid structure', () => {
      const response = createSimulateTransactionResponse();

      expect(response).toHaveProperty('latestLedger');
      expect(response).toHaveProperty('transactionData');
      expect(response).toHaveProperty('minResourceFee');
      expect(response).toHaveProperty('events');
      expect(response).toHaveProperty('cost');
      expect(response.cost).toHaveProperty('cpuInsn');
      expect(response.cost).toHaveProperty('memByte');
    });

    it('accepts custom resource costs', () => {
      const response = createSimulateTransactionResponse({
        cpuInsn: '5000',
        memByte: '10000',
      });

      expect(response.cost!.cpuInsn).toBe('5000');
      expect(response.cost!.memByte).toBe('10000');
    });
  });

  describe('Recorded Fixtures', () => {
    it('creates waste registered event', () => {
      const event = createWasteRegisteredEvent();

      expect(event.topic[0]).toBe('waste_registered');
      expect(event.value).toHaveLength(5);
    });

    it('creates participant registered event', () => {
      const event = createParticipantRegisteredEvent();

      expect(event.topic[0]).toBe('participant_registered');
    });

    it('creates waste transferred event', () => {
      const event = createWasteTransferredEvent();

      expect(event.topic[0]).toBe('waste_transferred');
    });

    it('creates tokens rewarded event', () => {
      const event = createTokensRewardedEvent();

      expect(event.topic[0]).toBe('tokens_rewarded');
    });

    it('allows overriding recorded fixture properties', () => {
      const customEvent = createWasteRegisteredEvent({
        ledger: 99999,
        type: 'custom',
      });

      expect(customEvent.ledger).toBe(99999);
      expect(customEvent.type).toBe('custom');
      expect(customEvent.topic[0]).toBe('waste_registered');
    });
  });

  describe('createEventsBatchResponse', () => {
    it('creates batch with multiple event types', () => {
      const eventTypes = [
        'waste_registered' as const,
        'participant_registered' as const,
        'waste_transferred' as const,
      ];

      const response = createEventsBatchResponse(eventTypes);

      expect(response.events).toHaveLength(3);
      expect(response.events[0].topic[0]).toBe('waste_registered');
      expect(response.events[1].topic[0]).toBe('participant_registered');
      expect(response.events[2].topic[0]).toBe('waste_transferred');
    });

    it('accepts custom options for batch', () => {
      const customLedger = 80000;

      const response = createEventsBatchResponse(
        ['waste_registered', 'tokens_rewarded'],
        { ledger: customLedger }
      );

      expect(response.ledger).toBe(customLedger);
      expect(response.latestLedger).toBe(customLedger);
    });

    it('creates empty batch when no event types specified', () => {
      const response = createEventsBatchResponse();

      expect(response.events).toHaveLength(0);
    });
  });
});
