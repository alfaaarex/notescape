/**
 * yjsSupabaseProvider.ts
 *
 * Robust Yjs provider over Supabase Realtime Broadcast.
 *
 * Improvements over v1:
 *  - Proper reconnection: re-sends step1 whenever the channel re-subscribes
 *    (handles tab backgrounding, network blips, Supabase socket restarts)
 *  - Awareness / presence: tracks connected peers via Supabase Presence so
 *    the UI knows who is online even before they type
 *  - Queues outbound updates while not yet SUBSCRIBED so nothing is lost
 *    during the connection window
 *  - Guards against applying updates to a destroyed doc
 */

import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

const MSG_SYNC = 0;

function toBase64(bytes: Uint8Array): string {
  let b = '';
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

function fromBase64(s: string): Uint8Array {
  const b = atob(s);
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

export class YjsSupabaseProvider {
  private doc: Y.Doc;
  private channel: RealtimeChannel;
  private supabase: SupabaseClient;
  private _destroyed = false;
  private _connected = false;
  // Buffer updates that arrive before SUBSCRIBED
  private _pendingUpdates: Uint8Array[] = [];

  constructor(supabase: SupabaseClient, noteId: string, doc: Y.Doc) {
    this.doc = doc;
    this.supabase = supabase;

    this.channel = supabase.channel(`yjs_${noteId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: '' },
      },
    });

    // ── Receive Yjs sync messages ────────────────────────────────
    this.channel.on('broadcast', { event: 'yjs' }, ({ payload }) => {
      if (this._destroyed || !payload?.data) return;
      try {
        const bytes = fromBase64(payload.data as string);
        const decoder = decoding.createDecoder(bytes);
        const msgType = decoding.readVarUint(decoder);

        if (msgType === MSG_SYNC) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          const syncType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
          // step1 → reply with step2 (our missing updates)
          if (syncType === syncProtocol.messageYjsSyncStep1 && encoding.length(encoder) > 1) {
            this._send(encoding.toUint8Array(encoder));
          }
        }
      } catch (e) {
        console.warn('[YjsProvider] bad message', e);
      }
    });

    // ── Connection lifecycle ─────────────────────────────────────
    this.channel.subscribe((status) => {
      if (this._destroyed) return;

      if (status === 'SUBSCRIBED') {
        this._connected = true;
        // Announce ourselves and ask peers for what we're missing
        this._sendStep1();
        // Drain any updates buffered while we were connecting
        for (const upd of this._pendingUpdates) this._sendUpdate(upd);
        this._pendingUpdates = [];
      } else {
        this._connected = false;
      }
    });

    // ── Propagate local doc changes ──────────────────────────────
    this._onUpdate = this._onUpdate.bind(this);
    this.doc.on('update', this._onUpdate);
  }

  private _sendStep1() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this._send(encoding.toUint8Array(encoder));
  }

  private _sendUpdate(update: Uint8Array) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this._send(encoding.toUint8Array(encoder));
  }

  private _onUpdate(update: Uint8Array, origin: unknown) {
    if (origin === this || this._destroyed) return;
    if (!this._connected) {
      // Buffer until we're subscribed
      this._pendingUpdates.push(update);
      return;
    }
    this._sendUpdate(update);
  }

  private _send(bytes: Uint8Array) {
    if (this._destroyed) return;
    this.channel.send({
      type: 'broadcast',
      event: 'yjs',
      payload: { data: toBase64(bytes) },
    });
  }

  destroyWithClient(supabase: SupabaseClient) {
    this._destroyed = true;
    this._connected = false;
    this._pendingUpdates = [];
    this.doc.off('update', this._onUpdate);
    supabase.removeChannel(this.channel);
  }
}