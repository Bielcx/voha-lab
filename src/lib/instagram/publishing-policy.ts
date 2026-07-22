import { z } from "zod";

const metaErrorEnvelopeSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().int().optional(),
    error_subcode: z.number().int().optional(),
    is_transient: z.boolean().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export type SafeMetaError = {
  httpStatus: number;
  code: number | null;
  subcode: number | null;
  type: string | null;
  traceId: string | null;
  retryable: boolean;
};

export function sanitizeMetaError(httpStatus: number, body: unknown): SafeMetaError {
  const parsed = metaErrorEnvelopeSchema.safeParse(body);
  const error = parsed.success ? parsed.data.error : null;
  return {
    httpStatus,
    code: error?.code ?? null,
    subcode: error?.error_subcode ?? null,
    type: error?.type ?? null,
    traceId: error?.fbtrace_id ?? null,
    retryable: Boolean(error?.is_transient) || httpStatus === 429 || httpStatus >= 500,
  };
}

export function publicMetaErrorMessage(error: SafeMetaError) {
  if (error.httpStatus === 401 || error.code === 190) {
    return "A conexão com o Instagram expirou. Reconecte a conta e tente novamente.";
  }
  if (error.httpStatus === 429 || error.code === 4 || error.code === 17 || error.code === 32) {
    return "A Meta limitou temporariamente as publicações. O Voha tentará novamente.";
  }
  if (error.httpStatus >= 500) {
    return "A Meta está temporariamente indisponível. O Voha tentará novamente.";
  }
  return "A Meta recusou esta mídia. Revise o formato e tente novamente.";
}

export function canRetryPublicationAutomatically(
  providerMarkedRetryable: boolean,
  publishWasDispatched: boolean,
) {
  return providerMarkedRetryable && !publishWasDispatched;
}
