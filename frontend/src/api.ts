export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail

    if (typeof detail === 'string') {
      return detail
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string }

      if (first?.msg) {
        return first.msg
      }
    }
  }

  return fallback
}

export async function apiFetch<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, 'O Sistema não respondeu como esperado'))
  }

  return data as T
}

export async function registerUser(email: string, name: string, password: string) {
  return apiFetch<{ id: number; email: string; name: string | null }>('/auth/register', null, {
    method: 'POST',
    body: JSON.stringify({ email, name, password }),
  })
}
