/**
 * Public configuration for the newsletter signup flow.
 * Update launchPhase.daysRemaining manually whenever you publish a timeline update.
 */
window.LUMINA_PUBLIC_CONFIG = {
  newsletterSignupUrl: 'https://uvhfznpsixghjxjxoztr.supabase.co/functions/v1/newsletter-signup',
  turnstileSiteKey: '0x4AAAAAACqRNfFec-fD7ztC',
  launchPhase: {
    totalDays: 90,
    daysRemaining: 90
  }
};
