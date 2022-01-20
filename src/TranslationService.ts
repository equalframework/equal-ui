import { $ } from "./jquery-lib";
import { environment } from "./environment";

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

    constructor() {
        this.resolved = null;

        this.init();
    }

    private init() {
        this.translations = $.Deferred();
        this.resolved = false;

        // load i18n file from server
        fetch('/assets/i18n/'+environment.locale+'.json')
        .then( (response) => {
            if(response.ok) {
                response.json().then( (data) => {
                    this.resolved = data;
                    this.translations.resolve(data);                    
                });
            }
            else {
                this.translations.resolve({});
            }        
        })
        .catch( (err:any) => {
            console.log('error fetch UI translation file');
            this.translations.resolve({});
        });

    }

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


    /**
     * Instant translation (non-blocking). If no value is found the given string is returned as result.
     * *
     * @param value 
     */
    public instant(value:string) {
        let translation: string = value;
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
     * @param translation   Object holding the translations values (as returned by `ApiService::getTranslation()`)
     * @param type          Kind of terms we want to perform ('model','view','error')
     * @param id            The identifier of the item we want to translate
     * @param value         The default value, if any, to fall back to in case translation fails 
     * @param property       The translation section we're looking for, for the considered value ('label', 'help', ...)
     * 
     * @returns The translated value, or the original value if translation fails.
     */ 
    public resolve(translation:any, type:string, path: string[], id: string, value: any = '', property:string = 'label') {
        let result = value;

        if (typeof value === 'string' || value instanceof String) {
            result = value.charAt(0).toUpperCase() + value.replace(/_/g, ' ').slice(1);
        }
        
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
        return result;
    }
    
}



export default _TranslationService;