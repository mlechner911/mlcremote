import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import MessageBox from '../components/MessageBox'

/**
 * Configuration options for the modal dialog.
 */
export type DialogOptions = {
    /** Dialog title */
    title: string
    /** Main body message */
    message: string
    /** Callback when user confirms/submits */
    onConfirm?: (value?: string) => void
    /** Label for component button (default: "Confirm") */
    confirmLabel?: string
    /** Label for cancel button (default: "Cancel") */
    cancelLabel?: string
    /** If present, renders an input of this type (e.g. "text", "password") */
    inputType?: string
    /** Initial value for input field */
    defaultValue?: string
    /** Placeholder text for input field */
    placeholder?: string
    /** Visual variant of the dialog */
    variant?: 'info' | 'error' | 'warning' | 'success'
}

type DialogContextType = {
    /** Triggers a new dialog with the specified options */
    showDialog: (options: DialogOptions) => void
    /** Closes the currently open dialog */
    closeDialog: () => void
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

/**
 * Hook to access the dialog context. Must be used within a DialogProvider.
 */
export function useDialog() {
    const context = useContext(DialogContext)
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider')
    }
    return context
}

/**
 * Global provider for managing a single modal dialog instance.
 * Renders the dialog component when state is active.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
    const [dialogState, setDialogState] = useState<DialogOptions | null>(null)

    const showDialog = useCallback((options: DialogOptions) => {
        setDialogState(options)
    }, [])

    const closeDialog = useCallback(() => {
        setDialogState(null)
    }, [])

    return (
        <DialogContext.Provider value={{ showDialog, closeDialog }}>
            {children}
            {dialogState && (
                <MessageBox
                    title={dialogState.title}
                    message={dialogState.message}
                    variant={dialogState.variant}
                    onClose={closeDialog}
                    onConfirm={dialogState.onConfirm ? (val) => {
                        dialogState.onConfirm!(val)
                        closeDialog()
                    } : undefined}
                    confirmLabel={dialogState.confirmLabel}
                    cancelLabel={dialogState.cancelLabel}
                    inputType={dialogState.inputType}
                    defaultValue={dialogState.defaultValue}
                    placeholder={dialogState.placeholder}
                />
            )}
        </DialogContext.Provider>
    )
}
