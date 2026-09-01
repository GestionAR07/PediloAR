export const MERCHANT_APPLICATION_LIMITS = {
  businessName: 120,
  contactName: 80,
  contactEmail: 254,
  contactPhone: 32,
  description: 2000,
  message: 2000,
} as const;

export const MAX_PENDING_APPLICATIONS_PER_EMAIL = 3;
