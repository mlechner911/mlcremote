import { useState } from 'react'
import { ProbeConnection } from '../wailsjs/go/app/App'
import { useI18n } from '../utils/i18n'
import { ConnectionProfile } from '../types'

export function useConnectionTester() {
    const { t } = useI18n()
    const [testStatus, setTestStatus] = useState('')
    const [isTesting, setIsTesting] = useState(false)

    const testConnection = async (p: Partial<ConnectionProfile>) => {
        setTestStatus(t('status_checking'))
        setIsTesting(true)
        try {
            // @ts-ignore
            const res = await ProbeConnection({
                host: p.host || '',
                user: p.user || '',
                port: Number(p.port) || 22,
                identityFile: p.identityFile || '',
                password: ''
            })

            if (res === 'ok') {
                setTestStatus(t('connection_ok'))
                // Auto-clear success message after 3s
                setTimeout(() => setTestStatus(''), 3000)
                return 'ok'
            } else if (res === 'auth-failed' || res === 'no-key') {
                // Use hardcoded string fallback or existing keys if unsure.
                // t('status_failed') is safe.
                setTestStatus(t('status_failed') + ': ' + res)
                return res
            } else {
                setTestStatus(`${t('status_failed')}: ${res}`)
                return res
            }
        } catch (e: any) {
            setTestStatus(`${t('status_failed')}: ${e.message || e}`)
            return 'error'
        } finally {
            setIsTesting(false)
        }
    }

    return {
        testStatus,
        setTestStatus,
        isTesting,
        testConnection
    }
}
