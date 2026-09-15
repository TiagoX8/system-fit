export interface Workout {
  id: number
  user_id: number
  title: string
  description: string | null
  scheduled_time: string
  days_of_week: number[]
  created_at: string
  completed_today: boolean
}

export interface WorkoutInput {
  title: string
  description: string
  scheduled_time: string
  days_of_week: number[]
}

export interface WorkoutLog {
  id: number
  user_id: number
  workout_id: number
  date: string
  completed: boolean
  completed_at: string | null
}

export interface Reward {
  id: number
  title: string
  description: string | null
  threshold_weeks: number
  unlocked: boolean
  unlocked_at: string | null
}

export interface Punishment {
  id: number
  title: string
  description: string | null
  threshold_streak: number
  unlocked: boolean
  unlocked_at: string | null
}

export interface RewardInput {
  title: string
  description: string
  threshold_weeks: number
}

export interface PunishmentInput {
  title: string
  description: string
  threshold_streak: number
}

export interface Progress {
  current_streak: number
  longest_streak: number
  xp: number
  rank: string
  next_rank: string | null
  xp_to_next_rank: number | null
  weeks_completed: number
  last_completed_date: string | null
  rewards: Reward[]
  punishments: Punishment[]
}

export interface CompleteWorkoutResult {
  log: WorkoutLog
  progress: Progress
  message: string
  unlocked_rewards: Reward[]
}

export interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CoachStatus {
  enabled: boolean
  messages_per_day: number
}

export interface CoachReply {
  reply: string
  remaining_today: number
}

export const AVATAR_SLOTS = [
  'char_class',
  'skin',
  'hair',
  'hair_color',
  'outfit',
  'weapon',
] as const

export type AvatarSlot = (typeof AVATAR_SLOTS)[number]

export type AvatarEquipped = Record<AvatarSlot, string>

export interface AvatarPiece {
  id: string
  name: string
  rank: string
  description: string
  colors: Record<string, string>
  features: string[]
  /** Quando preenchido, só a classe indicada pode equipar a peça. */
  class_id: string | null
  unlocked: boolean
}

export interface AvatarState {
  equipped: AvatarEquipped
  rank: string
  catalog: Record<AvatarSlot, AvatarPiece[]>
}

export const AVATAR_SLOT_LABELS: Record<AvatarSlot, string> = {
  char_class: 'Classe',
  skin: 'Pele',
  hair: 'Cabelo',
  hair_color: 'Cor do cabelo',
  outfit: 'Set de roupa',
  weapon: 'Arma',
}

export const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
