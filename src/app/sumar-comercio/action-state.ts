export type SubmitMerchantApplicationActionState = {
  error: string | null;
  success: boolean;
};

export const submitMerchantApplicationInitialState: SubmitMerchantApplicationActionState =
  {
    error: null,
    success: false,
  };
