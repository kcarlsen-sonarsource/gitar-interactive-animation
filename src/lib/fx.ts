/** Tiny shared signal bus for global effects triggered by chapters. */
export const fx = {
  flash: 0,
  shake: 0,
  bloomBoost: 0,
  trigger(flash = 0.25, shake = 0.4) {
    fx.flash = Math.max(fx.flash, flash);
    fx.shake = Math.max(fx.shake, shake);
  },
};
