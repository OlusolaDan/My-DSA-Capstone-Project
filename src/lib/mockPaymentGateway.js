export function createMockPaymentGateway() {
  return {
    async charge({ decline = false } = {}) {
      return decline ? { success: false } : { success: true };
    },
  };
}
