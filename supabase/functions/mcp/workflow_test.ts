import { attachmentInput, downloadAttachment, maxAttachmentBytes, readAttachment, type RawAttachment } from './workflow.ts'
import { TaskError } from './task.ts'

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed') }
const taskId = '00000000-0000-0000-0000-000000000001'
const attachmentId = '00000000-0000-0000-0000-000000000002'
const base = 'https://example.test'
const input = attachmentInput.parse({ task_id: taskId, attachment_id: attachmentId, max_chars: 4 })
const raw: RawAttachment = { id: attachmentId, task_id: taskId, file_name: 'context.txt', mime_type: 'text/plain',
  file_size: 8, file_url: `${base}/storage/v1/object/public/task-attachments/${taskId}/context.txt` }
const sign = () => Promise.resolve(`${base}/storage/v1/object/sign/task-attachments/${taskId}/context.txt?token=fixture`)

Deno.test('text attachments return untrusted UTF-8 chunks with explicit continuation, not just URLs', async () => {
  const download = () => Promise.resolve(new TextEncoder().encode('Hola 🌍 mundo'))
  const first = await readAttachment(input, raw, base, sign, download)
  const data = JSON.parse(first.content[0].type === 'text' ? first.content[0].text : '{}')
  assert(data.untrusted_content === 'Hola' && data.next_offset === 4 && data.kind === 'text')
  assert(!('file_url' in data))
  const last = await readAttachment({ ...input, offset: 4, max_chars: 12000 }, raw, base, sign, download)
  const final = JSON.parse(last.content[0].type === 'text' ? last.content[0].text : '{}')
  assert(final.untrusted_content === ' 🌍 mundo' && final.next_offset === null)
})
Deno.test('supported images become MCP image content; documents explicitly remain unexamined', async () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10])
  const image = await readAttachment(input, { ...raw, file_name: 'image.png', mime_type: 'image/png' }, base, sign, () => Promise.resolve(png))
  assert(image.content[1].type === 'image' && image.content[1].mimeType === 'image/png')
  const pdf = await readAttachment(input, { ...raw, file_name: 'file.pdf', mime_type: 'application/pdf' }, base, sign,
    () => { throw new Error('Unsupported documents should not download') })
  assert(pdf.content[0].type === 'text' && JSON.parse(pdf.content[0].text).kind === 'unsupported')
})
Deno.test('unsafe, mismatched, oversized, binary and non-UTF-8 attachments fail closed', async () => {
  for (const entry of [{ ...raw, task_id: attachmentId }, { ...raw, file_url: 'https://evil.test/file.txt' },
    { ...raw, file_size: maxAttachmentBytes + 1 }]) {
    let rejected = false
    try { await readAttachment(input, entry, base, sign, () => { throw new Error('Must not download') }) }
    catch (error) { rejected = error instanceof TaskError }
    assert(rejected)
  }
  for (const bytes of [new Uint8Array([0, 1]), new Uint8Array([255]), new Uint8Array(maxAttachmentBytes + 1)]) {
    let rejected = false
    try { await readAttachment(input, raw, base, sign, () => Promise.resolve(bytes)) }
    catch (error) { rejected = error instanceof TaskError }
    assert(rejected)
  }
})
Deno.test('downloader refuses arbitrary hosts and buckets before making requests', async () => {
  for (const url of ['https://evil.test/file', `${base}/storage/v1/object/sign/avatars/file`]) {
    let rejected = false
    try { await downloadAttachment(url, base) } catch { rejected = true }
    assert(rejected)
  }
})

Deno.test('streamed downloads enforce the actual byte limit and disable redirects', async () => {
  const original = globalThis.fetch
  let cancelled = false
  globalThis.fetch = (_input, init) => {
    assert(init && 'redirect' in init && init.redirect === 'error' && 'signal' in init && init.signal)
    return Promise.resolve(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(maxAttachmentBytes + 1)) },
      cancel() { cancelled = true },
    }), { headers: { 'Content-Length': '1' } }))
  }
  try {
    let rejected = false
    try { await downloadAttachment(await sign(), base) } catch { rejected = true }
    assert(rejected && cancelled)
  } finally { globalThis.fetch = original }
})
