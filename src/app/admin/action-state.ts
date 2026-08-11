/**
 * Action UI state shared by admin forms.
 * Lives outside use-server modules: Server Action entry files may only
 * export async functions as runtime values (Next.js constraint).
 */

export type ActionState = {
  error: string | null;
  success: string | null;
};

export type CreateMerchantActionState = ActionState & {
  merchantId?: string;
};

export const initialActionState: ActionState = {
  error: null,
  success: null,
};
