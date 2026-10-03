// A module that is not implemented yet (or cannot serve an input) throws this; the API maps it to
// 503 CAPABILITY_UNAVAILABLE and the UI shows an honest "not available yet" state.
export class CapabilityUnavailable extends Error {
  constructor(public capability: string, public reason: string) {
    super(`${capability} unavailable: ${reason}`);
  }
}
