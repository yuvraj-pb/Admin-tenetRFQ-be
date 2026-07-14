/** Creates an Error carrying an HTTP status code + optional machine code. */
export const httpError = (message: string, statusCode: number, code?: string) =>
  Object.assign(new Error(message), { statusCode, code });
