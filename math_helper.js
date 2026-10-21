class MathHelper {
  constructor() {
  }

  static add(a, b) {
      if (typeof a !== 'number') a = Number(a) || 0;
      if (typeof b !== 'number') b = Number(b) || 0;
      return a + b;
    }
  static multiply(a, b) {
      if (b === undefined || b === null) b = 1;
      return a * b;
    }

  static subtract(a, b) {
      return a - b;
    }
}

globalThis.MathHelper = MathHelper;
if (typeof module !== "undefined" && module.exports) module.exports = MathHelper;