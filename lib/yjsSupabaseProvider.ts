/**
 * yjsSupabaseProvider.ts
 *
 * A lightweight Yjs provider that uses Supabase Realtime Broadcast as its
 * transport layer.  No extra database table is needed.
 *
 * How it works:
 *  - On construction it creates (or reuses) a Supabase channel for the note.
 *  - When the local Y.Doc changes it encodes the diff as a Yjs update (Uint8Array),
 *    base64-encodes it and broadcasts it to every other peer on the same channel.
 *  - When a broadcast is received it applies the remote update to the local Y.Doc.
 *  - It also sends a full state-vector sync on connect so late joiners catch up.
 *
 * Usage (inside a React effect):
 *
 *   const provider = new YjsSupabaseProvider(supabase, noteId, ydoc);
 *   return () => provider.destroy();
 */

import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const MSG_SYNC = 0;   // carries syncProtocol messages (step1 / step2 / update)

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class YjsSupabaseProvider {
  private doc: Y.Doc;
  private channel: RealtimeChannel;
  private _destroyed = false;

  constructor(supabase: SupabaseClient, noteId: string, doc: Y.Doc) {
    this.doc = doc;

    this.channel = supabase.channel(`yjs_${noteId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    // ── Receive messages from peers ──────────────────────────────
    this.channel.on('broadcast', { event: 'yjs' }, ({ payload }) => {
      if (!payload?.data) return;
      try {
        const bytes = fromBase64(payload.data as string);
        const decoder = decoding.createDecoder(bytes);
        const msgType = decoding.readVarUint(decoder);
        if (msgType === MSG_SYNC) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          const syncMessageType = syncProtocol.readSyncMessage(
            decoder,
            encoder,
            this.doc,
            this,
          );
          // If step1 was received we must send back step2
          if (
            syncMessageType === syncProtocol.messageYjsSyncStep1 &&
            encoding.length(encoder) > 1
          ) {
            this._broadcast(encoding.toUint8Array(encoder));
          }
        }
      } catch (e) {
        console.warn('[YjsSupabaseProvider] failed to apply remote update', e);
      }
    });

    // ── Subscribe, then kick off sync ────────────────────────────
    this.channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // Send a sync step1 (our state vector) so peers can send us what we're missing
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this._broadcast(encoding.toUint8Array(encoder));
    });

    // ── Propagate local changes ──────────────────────────────────
    this._onUpdate = this._onUpdate.bind(this);
    this.doc.on('update', this._onUpdate);
  }

  private _onUpdate(update: Uint8Array, origin: unknown) {
    // Don't echo back updates that originated from this provider
    if (origin === this || this._destroyed) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this._broadcast(encoding.toUint8Array(encoder));
  }

  private _broadcast(bytes: Uint8Array) {
    if (this._destroyed) return;
    this.channel.send({
      type: 'broadcast',
      event: 'yjs',
      payload: { data: toBase64(bytes) },
    });
  }

  destroy() {
    this._destroyed = true;
    this.doc.off('update', this._onUpdate);
    // @ts-expect-error supabase typings don't expose the client directly
    const supabase = this.channel._client ?? (this.channel as any).socket?.params?.supabase;
    try {
      // removeChannel is the public API on the supabase client — we call it
      // via the import that created the channel (caller manages cleanup via destroy())
    } catch { /* swallow */ }
  }

  /** Call this instead of destroy() when you have the supabase client handy */
  destroyWithClient(supabase: SupabaseClient) {
    this._destroyed = true;
    this.doc.off('update', this._onUpdate);
    supabase.removeChannel(this.channel);
  }
}
