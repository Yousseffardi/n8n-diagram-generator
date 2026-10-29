const BASE64_HINT = /^[A-Za-z0-9+/=\s]+$/

export function resolveWebhookUrl(rawUrl) {
  return rawUrl.trim()
}

function asDataUrl(value) {
  if (typeof value !== 'string' || value.length < 80) return null
  if (value.startsWith('data:image/')) return value
  const compact = value.replace(/\s/g, '')
  if (compact.length > 200 && BASE64_HINT.test(value.slice(0, 240))) {
    return `data:image/png;base64,${compact}`
  }
  return null
}

export function findImageDataUrl(value, depth = 0) {
  if (depth > 7 || value == null) return null

  if (typeof value === 'string') return asDataUrl(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageDataUrl(item, depth + 1)
      if (found) return found
    }
    return null
  }

  if (typeof value === 'object') {
    const preferred = ['data', 'image', 'imageBase64', 'base64', 'file', 'binary']
    for (const key of preferred) {
      if (key in value) {
        const found = findImageDataUrl(value[key], depth + 1)
        if (found) return found
      }
    }
    for (const nested of Object.values(value)) {
      const found = findImageDataUrl(nested, depth + 1)
      if (found) return found
    }
  }

  return null
}

const TEST_WEBHOOK_HINT =
  'n8n answered this HTTP call before the workflow finished (common with Listen for test event). The page cannot wait after that reply. Activate the workflow and use the production webhook so Respond to Webhook can send the PNG when generation is done.'

export async function blobFromWebhookResponse(response) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  const buffer = await response.arrayBuffer()
  const isImage = contentType.startsWith('image/') || contentType.includes('octet-stream') || contentType.includes('binary')

  if (isImage && buffer.byteLength > 32) {
    return new Blob([buffer], { type: contentType.startsWith('image/') ? contentType : 'image/png' })
  }

  const text = new TextDecoder().decode(buffer).trim()
  if (!text) {
    throw new Error(TEST_WEBHOOK_HINT)
  }

  if (contentType.includes('json') || text.startsWith('{') || text.startsWith('[')) {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(TEST_WEBHOOK_HINT)
    }
    const dataUrl = findImageDataUrl(parsed)
    if (!dataUrl) {
      throw new Error(TEST_WEBHOOK_HINT)
    }
    const imageResponse = await fetch(dataUrl)
    return imageResponse.blob()
  }

  throw new Error(TEST_WEBHOOK_HINT)
}

export async function generateDiagram(webhookUrl, payload, signal) {
  const url = resolveWebhookUrl(webhookUrl)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      detail
        ? `Webhook failed (${response.status}): ${detail.slice(0, 180)}`
        : `Webhook failed with status ${response.status}.`,
    )
  }

  return blobFromWebhookResponse(response)
}
