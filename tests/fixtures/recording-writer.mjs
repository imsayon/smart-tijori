export function recordingWriter(classify = () => undefined) {
  const documents = new Map();
  const calls = [];
  return {
    documents,
    calls,
    async writeProjection(offers) {
      calls.push(structuredClone(offers));
      return offers.map((offer) => {
        const documentId = `${offer.storeId}:${offer.productId}`;
        const failure = classify(offer, offers);
        if (failure !== undefined) return { documentId, status: "failed", retryable: failure };
        if ((documents.get(documentId)?.inventoryVersion ?? 0) >= offer.inventoryVersion) {
          return { documentId, status: "unchanged" };
        }
        documents.set(documentId, offer);
        return { documentId, status: "applied" };
      });
    },
  };
}
