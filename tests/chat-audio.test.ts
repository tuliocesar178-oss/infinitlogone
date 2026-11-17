import { describe, expect, it } from 'bun:test';
import { audioExtension } from '../src/lib/chat-audio';
describe('chat recorded audio formats', () => {
  it('accepts Android Chrome Opus recordings', () => { expect(audioExtension('audio/webm;codecs=opus')).toBe('webm'); });
  it('accepts iPhone Safari recordings', () => { expect(audioExtension('audio/mp4')).toBe('m4a'); });
  it('rejects non-audio uploads', () => { expect(() => audioExtension('text/html')).toThrow(); });
});