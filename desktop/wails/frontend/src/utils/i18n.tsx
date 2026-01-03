import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, LocaleType } from '../locales';

type Language = 'en' | 'de' | 'es' | 'fr';

interface I18nContextType {
    lang: Language;
    setLang: (l: Language) => void;
    t: (key: keyof LocaleType) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>(() => {
        const saved = localStorage.getItem('mlcremote_lang');
        return (saved as Language) || 'en';
    });

    const setLang = (l: Language) => {
        setLangState(l);
        localStorage.setItem('mlcremote_lang', l);
    };

    const t = (key: keyof LocaleType): string => {
        const dict = translations[lang] || translations['en'];
        return dict[key] || (translations['en'][key] as string) || key;
    };

    return (
        <I18nContext.Provider value={{ lang, setLang, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}
