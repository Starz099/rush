/**
 * Helper to unwrap specta responses.
 */
export const unwrap = async <T>(
  promise: Promise<
    { status: 'ok'; data: T } | { status: 'error'; error: string }
  >,
): Promise<T> => {
  const result = await promise;
  if (result.status === 'ok') return result.data;
  throw new Error(result.error);
};
