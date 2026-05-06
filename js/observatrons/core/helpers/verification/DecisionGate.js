export class DecisionGate {
  static run(connectionId, source, target) {
    console.log(`[DecisionGate] connection=${connectionId}  source=${source.nodeId}:${source.spikeIndex} → target=${target.nodeId}:${target.spikeIndex}`);
  }
}
