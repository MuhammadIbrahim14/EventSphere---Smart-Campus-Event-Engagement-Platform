import { supabase } from '../lib/supabase.js'
import { normalizeEnrollment, syntheticStudentEmail } from '../lib/enrollmentAuth.js'

function edgeError(error, fallback = 'Request failed') {
  if (!error) return { message: fallback }
  const msg =
    error.context?.body?.error ||
    error.message ||
    (typeof error === 'string' ? error : fallback)
  return { message: String(msg), code: error.context?.body?.code || error.code }
}

export async function provisionStudent(payload) {
  const { data, error } = await supabase.functions.invoke('provision-student', {
    body: payload,
  })
  if (error) return { data: null, error: edgeError(error) }
  if (data?.error) return { data: null, error: { message: data.error } }
  return { data, error: null }
}

export async function provisionStudentsBulk(students) {
  return provisionStudent({ students })
}

export async function studentLogin({ mode, identifier, password }) {
  const { data, error } = await supabase.functions.invoke('student-login', {
    body: { mode, identifier, password },
  })
  if (error) {
    let body = null
    try {
      body = typeof error.context?.json === 'function' ? await error.context.json() : error.context?.body
    } catch {
      body = null
    }
    return {
      data: null,
      error: {
        message: body?.error || error.message || 'Login failed',
        code: body?.code || 'invalid_credentials',
      },
    }
  }
  if (data?.error) {
    return { data: null, error: { message: data.error, code: data.code || 'invalid_credentials' } }
  }
  return { data, error: null }
}

export async function adminResetStudentPassword({ studentId, tempPassword }) {
  const { data, error } = await supabase.functions.invoke('admin-reset-student-password', {
    body: { studentId, tempPassword },
  })
  if (error) return { data: null, error: edgeError(error) }
  if (data?.error) return { data: null, error: { message: data.error } }
  return { data, error: null }
}

export { normalizeEnrollment, syntheticStudentEmail }
