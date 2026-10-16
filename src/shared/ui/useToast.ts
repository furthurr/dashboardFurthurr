import { useCallback, useState } from 'react'

export function useToast() {
  const [notice, setNoticeState] = useState<{ message: string } | null>(null)
  const setNotice = useCallback((message: string) => {
    setNoticeState(message ? { message } : null)
  }, [])
  const dismissNotice = useCallback(() => setNoticeState(null), [])

  return { notice, setNotice, dismissNotice }
}
