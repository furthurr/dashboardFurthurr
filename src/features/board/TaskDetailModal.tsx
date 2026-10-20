import { useId, useRef, useState } from 'react'
import type { TaskWithAssignees, TaskStatus, TaskPriority, CommentWithAuthor, TaskAttachment } from '@/types'
import { Dialog } from '@/shared/ui/Dialog'
import { Toast } from '@/shared/ui/Toast'
import { useToast } from '@/shared/ui/useToast'
import { BOARD_COLUMNS, PRIORITY_COLORS } from './constants'
import { CommentsList } from './CommentsList'
import { AttachmentsList } from './AttachmentsList'
import { AssigneePicker, type AssigneeOptions } from './AssigneePicker'

type Operation = void | Promise<unknown>
interface TaskDetailModalProps {
  task: TaskWithAssignees | null
  comments: CommentWithAuthor[]
  attachments: TaskAttachment[]
  isOpen: boolean
  onClose: () => void
  onSave?: (data: { title: string; description: string; status: TaskStatus; priority: TaskPriority }) => Operation
  onDelete?: () => Operation
  onAddComment?: (body: string) => Operation
  onDeleteComment?: (commentId: string) => Operation
  onUploadAttachment?: (file: File) => Operation
  onDeleteAttachment?: (attachmentId: string) => Operation
  canDeleteComments?: boolean
  canDeleteAttachments?: boolean
  commentsLoading?: boolean
  attachmentsLoading?: boolean
  commentsError?: boolean
  attachmentsError?: boolean
  onSaveAssignees?: (ids: string[]) => Operation
  assigneeOptions?: AssigneeOptions
}

// Unmounting on close also discards draft, tab and delete-confirmation state.
export function TaskDetailModal(props: TaskDetailModalProps) {
  if (!props.isOpen || !props.task) return null
  return <TaskDetailContent key={props.task.id} {...props} task={props.task} />
}

const tabs = ['details', 'comments', 'attachments'] as const
type Tab = typeof tabs[number]

function TaskDetailContent({ task, comments, attachments, onClose, onSave, onDelete,
  onAddComment, onDeleteComment, onUploadAttachment, onDeleteAttachment,
  canDeleteComments, canDeleteAttachments, commentsLoading, attachmentsLoading,
  commentsError, attachmentsError, onSaveAssignees, assigneeOptions,
}: TaskDetailModalProps & { task: TaskWithAssignees }) {
  const id = useId()
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map((person) => person.id))
  const [savedAssigneeIds, setSavedAssigneeIds] = useState(assigneeIds)
  const assignmentsDirty = assigneeIds.length !== savedAssigneeIds.length || assigneeIds.some((personId) => !savedAssigneeIds.includes(personId))
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const { notice, setNotice, dismissNotice } = useToast()
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'task' | 'comment' | 'attachment'; id?: string } | null>(null)
  const busy = pending !== null

  async function perform(name: string, action: () => Operation, failure: string, success = '') {
    if (pendingRef.current) return false
    pendingRef.current = true
    setPending(name)
    setError(null)
    setNotice('')
    try {
      await action()
      setNotice(success)
      return true
    } catch {
      // Hooks own network errors; show a safe, actionable message in context.
      setError(`${failure} Tus datos se conservan. Inténtalo de nuevo.`)
      return false
    } finally {
      pendingRef.current = false
      setPending(null)
    }
  }

  async function save() {
    if (!title.trim() || !onSave || assignmentsDirty) return
    if (await perform('save', () => onSave({ title: title.trim(), description, status, priority }), 'No se pudo guardar.')) onClose()
  }

  async function saveAssignees() {
    if (!onSaveAssignees || !assignmentsDirty) return
    if (await perform('assignees', () => onSaveAssignees(assigneeIds), 'No se pudieron guardar las asignaciones.', 'Asignaciones guardadas.')) {
      setSavedAssigneeIds([...assigneeIds])
    }
  }

  async function sendComment() {
    if (!comment.trim() || !onAddComment) return
    if (await perform('comment', () => onAddComment(comment.trim()), 'No se pudo enviar el comentario.', 'Comentario enviado.')) setComment('')
  }

  async function uploadAttachment(nextFile: File) {
    const upload = onUploadAttachment
    if (!upload) return
    const succeeded = await perform('upload', () => upload(nextFile), 'No se pudo subir el archivo.', 'Archivo adjuntado.')
    if (succeeded) setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeConfirmed() {
    if (!confirmDelete) return
    const { kind, id: itemId } = confirmDelete
    const action = kind === 'task' ? onDelete : kind === 'comment'
      ? () => onDeleteComment?.(itemId!) : () => onDeleteAttachment?.(itemId!)
    if (!action) return
    if (await perform('delete', action, 'No se pudo eliminar.', 'Elemento eliminado.')) {
      setConfirmDelete(null)
      if (kind === 'task') onClose()
    }
  }

  return (
    <Dialog title="Detalle de tarea" onClose={onClose} busy={busy}>
      <Toast notice={notice} onClose={dismissNotice} />
      <div role="tablist" aria-label="Contenido de la tarea" className="task-tabs">
        {tabs.map((tab, index) => (
          <button key={tab} type="button" role="tab" id={`${id}-${tab}-tab`}
            aria-controls={`${id}-${tab}-panel`} aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
              if (next === null) return
              event.preventDefault()
              setActiveTab(tabs[next])
              document.getElementById(`${id}-${tabs[next]}-tab`)?.focus()
            }}>
            {tab === 'details' ? 'Detalles' : tab === 'comments' ? `Comentarios (${comments.length})` : `Adjuntos (${attachments.length})`}
          </button>
        ))}
      </div>
      <div className="dialog-body space-y-5">
        {error && <p role="alert" className="ui-feedback ui-feedback--error">{error}</p>}
        <section role="tabpanel" id={`${id}-details-panel`} aria-labelledby={`${id}-details-tab`} hidden={activeTab !== 'details'}>
          <form id={`${id}-form`} onSubmit={(event) => { event.preventDefault(); void save() }}>
            <fieldset disabled={busy || !onSave} className="space-y-5">
              <div><label htmlFor={`${id}-title`} className="ui-label">Título</label>
                <input id={`${id}-title`} className="ui-field" value={title} required onChange={(event) => setTitle(event.target.value)} /></div>
              <div><label htmlFor={`${id}-description`} className="ui-label">Descripción</label>
                <textarea id={`${id}-description`} className="ui-field" rows={4} value={description} placeholder="Añade contexto para el equipo…" onChange={(event) => setDescription(event.target.value)} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label htmlFor={`${id}-status`} className="ui-label">Estado</label>
                  <select id={`${id}-status`} className="ui-field" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                    {BOARD_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}
                  </select></div>
                <div><label htmlFor={`${id}-priority`} className="ui-label">Prioridad</label>
                  <select id={`${id}-priority`} className="ui-field" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                    {Object.keys(PRIORITY_COLORS).map((key) => <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>)}
                  </select></div>
              </div>
            </fieldset>
          </form>
          {onSaveAssignees ? <div className="mt-5 space-y-3">
            <AssigneePicker {...assigneeOptions} initialAssignees={task.assignees} value={assigneeIds} onChange={setAssigneeIds} disabled={busy} />
            <p className="text-sm text-[var(--color-text-muted)]">Las asignaciones se guardan por separado de los demás campos de la tarea.</p>
            {assignmentsDirty && <p className="text-sm text-[var(--color-warning)]">Tienes cambios de asignación pendientes. Pulsa «Guardar asignaciones» antes de guardar los demás cambios.</p>}
            <button type="button" className="ui-button ui-button--primary" disabled={busy || !assignmentsDirty} onClick={() => { void saveAssignees() }}>
              {pending === 'assignees' ? 'Guardando asignaciones…' : 'Guardar asignaciones'}
            </button>
          </div> : task.assignees.length > 0 && <div className="mt-5"><p className="ui-label">Asignados</p><div className="flex flex-wrap gap-2">
            {task.assignees.map((person, index) => <span key={`${person.full_name}-${index}`} className="ui-feedback py-1">{person.full_name}</span>)}
          </div></div>}
          {task.special_notes && <p className="ui-feedback mt-5 text-[var(--color-warning)]">{task.special_notes}</p>}
        </section>
        <section role="tabpanel" id={`${id}-comments-panel`} aria-labelledby={`${id}-comments-tab`} hidden={activeTab !== 'comments'} className="space-y-5">
          {onAddComment && <form onSubmit={(event) => { event.preventDefault(); void sendComment() }}>
            <label htmlFor={`${id}-comment`} className="ui-label">Nuevo comentario</label>
            <div className="flex gap-2">
              <input id={`${id}-comment`} className="ui-field" value={comment} disabled={busy} placeholder="Escribe un comentario…" onChange={(event) => setComment(event.target.value)} />
              <button type="submit" className="ui-button ui-button--primary w-11 shrink-0 px-0"
                aria-label={pending === 'comment' ? 'Enviando…' : 'Enviar'}
                title={pending === 'comment' ? 'Enviando…' : 'Enviar'}
                aria-busy={pending === 'comment'} disabled={busy || !comment.trim()}>
                <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  {pending === 'comment'
                    ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
                    : <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>}
                </svg>
              </button>
            </div>
          </form>}
          {commentsLoading ? <p role="status">Cargando comentarios…</p> : commentsError ? <p role="alert" className="ui-feedback ui-feedback--error">No se pudieron cargar los comentarios. Vuelve a abrir la tarea para reintentar.</p>
            : <CommentsList comments={comments} canDelete={canDeleteComments && !busy} onDeleteComment={onDeleteComment ? (itemId) => setConfirmDelete({ kind: 'comment', id: itemId }) : undefined} />}
        </section>
        <section role="tabpanel" id={`${id}-attachments-panel`} aria-labelledby={`${id}-attachments-tab`} hidden={activeTab !== 'attachments'} className="space-y-5">
          {onUploadAttachment && <div className="space-y-3">
            <p id={`${id}-file-hint`} className="ui-label">Añadir archivo · máximo 5 MB</p>
            <input ref={fileRef} type="file" id={`${id}-file`} className="sr-only" tabIndex={-1} aria-hidden="true" disabled={busy}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null
                setError(null)
                if (next && next.size > 5 * 1024 * 1024) {
                  setError('El archivo debe ser de 5 MB o menos.')
                  setFile(null)
                  event.target.value = ''
                } else if (next) {
                  setFile(next)
                  void uploadAttachment(next)
                } else setFile(null)
              }} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="ui-button ui-button--secondary" aria-describedby={`${id}-file-hint`}
                disabled={busy} onClick={() => fileRef.current?.click()}>Seleccionar archivo</button>
              <span className="min-w-0 max-w-full truncate text-sm text-[var(--color-text-muted)]" aria-live="polite" aria-atomic="true">
                {pending === 'upload' && file ? `Subiendo ${file.name}…` : file?.name ?? 'Ningún archivo seleccionado'}
              </span>
            </div>
          </div>}
          {attachmentsLoading ? <p role="status">Cargando adjuntos…</p> : attachmentsError ? <p role="alert" className="ui-feedback ui-feedback--error">No se pudieron cargar los adjuntos. Vuelve a abrir la tarea para reintentar.</p>
            : <AttachmentsList attachments={attachments} canDelete={canDeleteAttachments && !busy} onDeleteAttachment={onDeleteAttachment ? (itemId) => setConfirmDelete({ kind: 'attachment', id: itemId }) : undefined} />}
        </section>
        {confirmDelete && <div className="ui-feedback ui-feedback--error space-y-3" role="group" aria-label="Confirmar eliminación">
          <p>¿Eliminar {confirmDelete.kind === 'task' ? 'esta tarea' : confirmDelete.kind === 'comment' ? 'este comentario' : 'este adjunto'}? Esta acción no se puede deshacer.</p>
          <div className="flex flex-wrap gap-2">
            <button className="ui-button ui-button--danger" disabled={busy} onClick={() => { void removeConfirmed() }}>{pending === 'delete' ? 'Eliminando…' : 'Sí, eliminar'}</button>
            <button className="ui-button" disabled={busy} onClick={() => setConfirmDelete(null)}>Cancelar eliminación</button>
          </div>
        </div>}
      </div>
      <footer className="dialog-footer">
        {onDelete && <button className="ui-button ui-button--danger sm:mr-auto" disabled={busy} onClick={() => setConfirmDelete({ kind: 'task' })}>Eliminar tarea</button>}
        <button className="ui-button ui-button--secondary" disabled={busy} onClick={onClose}>Cerrar</button>
        {onSave && <button type="submit" form={`${id}-form`} className="ui-button ui-button--primary" disabled={busy || !title.trim() || assignmentsDirty}>
          {pending === 'save' ? 'Guardando…' : 'Guardar cambios'}
        </button>}
      </footer>
    </Dialog>
  )
}
