// CapabilityHandler — handles a single host.request capability.
//
// Mirrors Android bindings/android/.../CapabilityHandler.java (functional
// interface). Implementations receive the parsed host.request.params record
// and return a HostReply (success with result, or error with code/message).
// The HostAdapter routes by capability string; HostBus encodes the reply as
// host.complete / host.error.

import { HostReply } from './HostReply';

export type CapabilityHandler = (params: Record<string, Object>) => Promise<HostReply>;
