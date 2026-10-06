// Stand-in for realtime-bpm-analyzer in check-audiorecovery.mjs (no AudioWorklet in node)
export const createRealtimeBpmAnalyzer = async () => ({ node: { connect() {}, disconnect() {} }, on() {}, stop() {} })
