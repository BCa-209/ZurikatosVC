const base = import.meta.env.VITE_API_BASE_URL || '/api';
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function request<T>(path: string, options: { token?: string; body?: unknown; signal?: AbortSignal; method?: string } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET', signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', ...(options.token ? { 'X-Operator-Token': options.token } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError('No pudimos conectar con el servicio. Comprueba la conexión y vuelve a intentarlo.', 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Revisa los valores e inténtalo nuevamente.', response.status);
  }
  return response.json() as Promise<T>;
}
