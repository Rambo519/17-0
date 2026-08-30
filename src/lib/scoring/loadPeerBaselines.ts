import snapshot from "./generated/peer-baselines.json";

import { loadBundledPeerBaselines, type PeerBaselineIndex } from "./peerBaselineSnapshot";

export function loadRuntimePeerBaselines(): PeerBaselineIndex {
  return loadBundledPeerBaselines(snapshot);
}
