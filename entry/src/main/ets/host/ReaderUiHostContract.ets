import type {
  HostRequestInitiator,
  HostRequestType,
} from '../contract/generated/HostRequestTable';

export type ReaderUiHostPayload = Record<string, Object>;

export interface ReaderUiHostRequest {
  type: string;
  payload: ReaderUiHostPayload;
  correlationId?: string;
  requestId?: string;
  initiator?: HostRequestInitiator;
}

export interface ReaderUiHostResponse {
  type: HostRequestType;
  result: ReaderUiHostPayload;
  correlationId?: string;
  requestId?: string;
}

export class ReaderUiHostFailure extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ReaderUiHostPlatform {
  isAvailable(type: HostRequestType): boolean;
  execute(type: HostRequestType, payload: ReaderUiHostPayload,
    request: ReaderUiHostRequest): Promise<ReaderUiHostPayload>;
}
