/**
 * Public configuration for the preview signup flow.
 * Replace the Turnstile site key with your real key before a wide public launch.
 * Update launchPhase.daysRemaining manually whenever you publish a timeline update.
 */
window.LUMINA_PUBLIC_CONFIG = {
  newsletterSignupUrl: 'https://uvhfznpsixghjxjxoztr.supabase.co/functions/v1/newsletter-signup',
  turnstileSiteKey: '1x00000000000000000000AA',
  launchPhase: {
    totalDays: 90,
    daysRemaining: 90
  }
};
