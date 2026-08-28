import { describe, expect, it } from 'vitest';
import { chainFor, chiliz, spicy } from '../src/chain.js';

describe('chainFor', () => {
  it('resolves the two Chiliz networks by id', () => {
    expect(chainFor(88888)).toBe(chiliz);
    expect(chainFor(88882)).toBe(spicy);
  });

  it('refuses an unknown chain id loudly (a mis-signed tx would just be rejected by the node)', () => {
    expect(() => chainFor(1)).toThrow(/unsupported CHAIN_ID/);
  });
});
