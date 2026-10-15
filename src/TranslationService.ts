import { EnvService } from "./equal-services";
import { $ } from "./jquery-lib";

/**
 * This service is in charge of loading the UI translations and provide getters to retrieve requested values.
 * It expects .json translation files in the /assets/i18n/ folder.
 *
 */
export class _TranslationService {

    // promise object
    private translations: any;

    // remember if the file fetching has been done
    private resolved: any;

    // locale currently loaded (or being loaded)
    private locale: string = '';

    constructor() {
        this.resolved = null;
        this.translations = $.Deferred();

        this.init();
    }

    public async init() {
        const environment: any = await EnvService.getEnv();

        // load i18n file from server
        // #todo - do not fetch directly the file, but use a dedicated controller
        const locale = environment.locale.slice(0, 2);

        // A second initialization for the same locale must reuse the current
        // translations, including while their request is still in progress.
        if(this.locale === locale) {
            return;
        }

        // Keep the Deferred created by the constructor for the first load so
        // early translate() calls do not remain attached to an abandoned one.
        const translations = (this.locale.length) ? $.Deferred() : this.translations;

        this.locale = locale;
        this.translations = translations;
        this.resolved = false;

        fetch('/assets/i18n/' + locale + '.json')
        .then( (response) => {
            if(response.ok) {
                return response.json();
            }
            return {};
        })
        .then( (data) => {
            // A slower response for a previous locale must not replace the
            // translations selected by a more recent init() call.
            if(this.locale === locale) {
                this.resolved = data;
            }
            translations.resolve(data);
        })
        .catch( (err:any) => {
            console.warn('error fetch UI translation file');
            translations.resolve({});
        });

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

    public async getTranslations(): Promise<Record<string, string>> {
        const translations = await this.translations;
        return translations || {};
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
