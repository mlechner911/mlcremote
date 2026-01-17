import React, { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '../driver-theme.css'
import { useTranslation } from 'react-i18next'
import { useAppSettings } from '../hooks/useAppSettings'

export default function OnboardingTour() {
    const { t } = useTranslation()
    const { settings, updateSettings } = useAppSettings()

    useEffect(() => {
        // Only run if not completed
        if (!settings || settings.onboardingCompleted) return

        const drive = driver({
            showProgress: true,
            animate: true,
            doneBtnText: t('done', 'Done'),
            nextBtnText: t('next', 'Next'),
            prevBtnText: t('previous', 'Previous'),
            allowClose: true,
            onDestroyed: () => {
                // Mark as completed when tour is finished or closed
                updateSettings({ onboardingCompleted: true })
            },
            steps: [
                {
                    element: '.modern-sidebar',
                    popover: {
                        title: t('tour_sidebar_title', 'File Explorer'),
                        description: t('tour_sidebar_desc', 'Navigate your remote filesystem here. Right-click files for more options.'),
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '.tab-bar',
                    popover: {
                        title: t('tour_tabs_title', 'Tab Management'),
                        description: t('tour_tabs_desc', 'Organize your work with tabs. You can drag to reorder or split views side-by-side.'),
                        side: 'bottom'
                    }
                },
                {
                    element: '.editor-body',
                    popover: {
                        title: t('tour_editor_title', 'Editor & Views'),
                        description: t('tour_editor_desc', 'Edit code, view images, or watch videos. The view adapts to the file type.'),
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '.status-bar',
                    popover: {
                        title: t('tour_status_title', 'Status Bar'),
                        description: t('tour_status_desc', 'Monitor connection health, latency, and current file info here.'),
                        side: 'top'
                    }
                },
                {
                    element: '.activity-icon[title="Settings"]',
                    popover: {
                        title: t('tour_settings_title', 'Adjust & Disconnect'),
                        description: t('tour_settings_desc', 'Open Settings to change theme, language, take screenshots, or disconnect from the server.'),
                        side: 'left'
                    }
                }
            ]
        })

        // Slight delay to ensure UI is rendered
        setTimeout(() => {
            drive.drive()
        }, 1000)

        return () => {
            drive.destroy()
        }
    }, [settings?.onboardingCompleted, updateSettings, t])

    return null // Controller component, renders nothing itself
}
