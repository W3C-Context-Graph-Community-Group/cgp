export class CompareClaims {
  static run(connectionId, source, target) {
    console.log(`[CompareClaims] connection=${connectionId}  source=${source.nodeId}:${source.spikeIndex} → target=${target.nodeId}:${target.spikeIndex}`);
  }
}
