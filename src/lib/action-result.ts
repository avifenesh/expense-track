export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: Record<string, string[]> }

export function success<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function successVoid(): ActionResult<void> {
  return { success: true, data: undefined }
}

export function failure(error: Record<string, string[]>): ActionResult<never> {
  return { success: false, error }
}

export function generalError(message: string): ActionResult<never> {
  return { success: false, error: { general: [message] } }
}
