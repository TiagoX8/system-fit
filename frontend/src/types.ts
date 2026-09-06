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

export const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
