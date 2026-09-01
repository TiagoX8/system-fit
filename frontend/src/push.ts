import { API_URL, apiFetch } from './api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)

  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Pede permissão, registra o service worker e envia a subscription ao backend.
 * Retorna a mensagem exibida ao usuário.
 */
export async function enablePushNotifications(token: string): Promise<string> {
  if (!pushSupported()) {
    return 'Este navegador não suporta Web Push. No iOS, instale o site na Tela de Início (iOS 16.4+).'
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    return 'Permissão de notificação negada: o Sistema não poderá te convocar.'
  }

  const { public_key: publicKey } = await apiFetch<{ public_key: string | null }>(
    '/push/public-key',
    token,
  )

  if (!publicKey) {
    return 'O servidor não tem chaves VAPID configuradas.'
  }

  const registration = await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }))

  const payload = subscription.toJSON() as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }

  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    return 'Não foi possível ler a subscription do navegador.'
  }

  await apiFetch(`/push/subscribe`, token, {
    method: 'POST',
    body: JSON.stringify({
      endpoint: payload.endpoint,
      keys: { p256dh: payload.keys.p256dh, auth: payload.keys.auth },
    }),
  })

  return `Convocações ativadas. O Sistema avisará você via ${new URL(API_URL).host}.`
}
