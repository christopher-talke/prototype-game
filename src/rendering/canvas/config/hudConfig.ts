/**
 * Design constants for the HUD overlay: kill feed, damage indicators, hit markers,
 * damage numbers, status labels, and low-health screen effects.
 */
export const hudConfig = {
  killFeedTimeout: 4000,
  damageIndicatorTimeout: 600,
  hitMarkerTimeout: 300,
  killBannerDuration: 1200,
  killBannerFadeOut: 500,
  damageNumberDuration: 800,
  damageNumberKillFontSize: 18,
  damageNumberNormalFontSize: 14,
  damageNumberKillColor: 0xff4444,
  damageNumberNormalColor: 0xffffff,
  damageNumberFloatSpeed: 0.04,
  statusLabelFontSize: 12,
  statusLabelColor: 0xdddddd,
  statusLabelYOffset: -52,
  statusLabelDeadTimeout: 2000,
  statusLabelDefaultTimeout: 1500,
  lowHealthBlurMax: 1.5,
};
