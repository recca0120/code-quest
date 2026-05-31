import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

export interface RpcSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(fn: (data: string) => void): void;
  onClose(fn: () => void): void;
  onError(fn: (err: Error) => void): void;
  ping(): void;
  onPong(fn: () => void): void;
  readonly readyState: number;
  readonly OPEN: number;
}

export type AcceptCallback = (onSocket: (socket: RpcSocket) => void) => void;

export interface CreateSocketOptions {
  headers?: Record<string, string>;
}

export interface WsAdapter {
  attach(
    server: HttpServer,
    onUpgrade: (
      req: IncomingMessage,
      rawSocket: Duplex,
      head: Buffer,
      accept: AcceptCallback,
    ) => void,
  ): void;
  createSocket(url: string, options?: CreateSocketOptions): Promise<RpcSocket>;
  close(): Promise<void>;
}
