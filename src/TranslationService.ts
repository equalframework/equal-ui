import { EnvService } from "./equal-services";

/**
 * This service is in charge of loading the UI translations and provide getters to retrieve requested values.
 * It expects .json translation files in the /assets/i18n/ folder.
 *
 */
export class _TranslationService {

    // promise object
    private translations: Promise<Record<string, string>>;

    // translations resolved for the current locale
    private resolved: Record<string, string> | null;

    // locale currently loaded (or being loaded)
    private locale: string = '';

    // one shared request per locale
    private readonly requests: Map<string, Promise<Record<string, string>>> = new Map();

    constructor() {
        this.resolved = null;
        this.translations = this.init();
    }

    public async init(requestedLocale: string = ''): Promise<Record<string, string>> {
        const environment: any = await EnvService.getEnv();

        // load i18n file from server
        // #todo - do not fetch directly the file, but use a dedicated controller
        const locale = (requestedLocale || environment.locale).slice(0, 2);

        const isCurrentLocale = this.locale === locale;
        let translations = this.requests.get(locale);

        if(!translations) {
            translations = fetch('/assets/i18n/' + locale + '.json')
            .then( (response) => response.ok ? response.json() : {})
            .catch( () => {
                console.warn('error fetch UI translation file');
                return {};
            });

            this.requests.set(locale, translations);
        }

        this.locale = locale;
        this.translations = translations;
        if(!isCurrentLocale) {
            this.resolved = null;
        }

        const data = await translations;

        // A slower response for a previous locale must not replace the
        // translations selected by a more recent init() call.
        if(this.locale === locale) {
            this.resolved = data;
        }

        return data;
    }

    /**
     * Handle an asynchronous request for translation.
     *
     * @param   value    string       The string identifier to translate using current language.
     * @returns Promise
     */
    public async translate(value:string) {
        let translation: string = '';
        try {
            const translations = await this.translations;
            if(translations.hasOwnProperty(value)) {
                translation = translations[value];
            }
        }
        catch {}
        return translation;
    }

    public getTranslations(locale: string = ''): Promise<Record<string, string>> {
        return this.init(locale);
    }


    /**
     * Handle instant request for translation (non-blocking).
     * If no value is found the given string is returned as result.
     *
     * @param   value   string
     * @returns string
     */
    public instant(value:string, _default:string = '') : string {
        let translation: string = (_default.length) ? _default : value;
        if(this.resolved) {
            if(this.resolved.hasOwnProperty(value)) {
                translation = this.resolved[value];
            }
        }
        return translation;
    }


    /**
     * Helper method for resolution from a `translation` object (as provided by the ApiService)
     *
     * @param translation   Object holding the translations values (as returned by `ApiService::getTranslation()`).
     * @param type          Kind of terms we want to perform (''<root>, 'model','view','error').
     * @param path          An array describing the path to follow within the translation map, if any.
     * @param id            The identifier of the item we want to translate.
     * @param value         Default value, if any, to fall back to in case translation fails.
     * @param property      The translation section we're looking for, for the considered value ('label', 'help', ...).
     *
     * @returns The translated value, or the original value if translation fails.
     */
    public resolve(translation: any, type: string, path: string[], id: string, value: any = '', property: string = 'label') {
        let result = value;

        if (typeof value === 'string' || value instanceof String) {
            result = value.charAt(0).toUpperCase() + value.replace(/_/g, ' ').slice(1);
        }

        if(type.length) {
            if(translation.hasOwnProperty(type)) {
                let map = translation[type];
                for(let elem of path) {
                    if(map && map.hasOwnProperty(elem)) {
                        map = map[elem];
                    }
                    else {
                        break;
                    }
                }

                if(map && map.hasOwnProperty(id)) {
                    if(map[id].hasOwnProperty(property)) {
                        result = map[id][property];
                    }
                }
            }
        }
        else {
            if(translation.hasOwnProperty(property)) {
                result = translation[property];
            }
        }
        return result;
    }

}


export default _TranslationService;
