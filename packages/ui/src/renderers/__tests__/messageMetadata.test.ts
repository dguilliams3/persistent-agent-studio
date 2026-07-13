import { describe, expect, it } from 'vitest';
import { parseMessageSenderMetadata } from '../messageMetadata';

describe('parseMessageSenderMetadata', () => {
  it('returns the sender from object metadata', () => {
    expect(parseMessageSenderMetadata({ from: 'Delphi' })).toEqual({
      from: 'Delphi',
    });
  });

  it('returns the sender from JSON string metadata', () => {
    expect(parseMessageSenderMetadata('{"from":"  Delphi  "}')).toEqual({
      from: 'Delphi',
    });
  });

  it('returns null for invalid or empty metadata', () => {
    expect(parseMessageSenderMetadata(null)).toBeNull();
    expect(parseMessageSenderMetadata('not-json')).toBeNull();
    expect(parseMessageSenderMetadata({ from: '' })).toBeNull();
  });
});
