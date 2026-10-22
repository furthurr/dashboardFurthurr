export type UserRole = 'admin' | 'usuario' | 'invitado'

export type TaskStatus = 'backlog' | 'por_hacer' | 'haciendo' | 'en_revision' | 'finalizadas'

export type TaskPriority = 'urgente' | 'alta' | 'normal' | 'baja'

export interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  nickname: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  board_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  special_notes: string | null
  created_by: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Board {
  id: string
  name: string
  is_active: boolean
  pending_count: number
  created_at: string
}

export type AssigneeProfile = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'role' | 'is_active'>

export interface TaskWithAssignees extends Task {
  assignees: AssigneeProfile[]
  comment_count?: number
  attachment_count?: number
}

export interface TaskAssignee {
  task_id: string
  profile_id: string
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
}

export interface CommentWithAuthor extends Comment {
  author: Profile
}

export interface TaskAttachment {
  id: string
  task_id: string
  uploaded_by: string
  file_name: string
  file_url: string
  signed_url?: string
  file_size: number
  mime_type: string
  created_at: string
}
