import { $, jqlocale } from "./jquery-lib";
import { UIHelper } from './material-lib';

import { ApiService, TranslationService } from "./equal-services";
import { Context, Layout, Model, Domain } from "./equal-lib";


/*
    Class holding a back-end controller representation.
    A controller can be handled the same way as a Model definition (both are called 'entity')
*/


export class Controller {

    public type: string;
    public operation: string;
    public lang: string;


    private entity: string;


    private params:any = {};
    private description:string = '';
    private response:any = {};

    private translation: any;

    /**
     *
     * @param type      type of controller ('do', 'get', 'show')
     * @param operation      path of the operation (e.g. 'core_model_collect')
     */
    constructor(type: string, operation: string, lang: string) {
        this.type = type;
        this.operation = operation;
        this.lang = lang;


        this.entity = operation.replace(/_/g, '\\');
        this.init();
    }

    private async init() {
        console.debug('Controller::init');

        // 2) retrieve announcement from the target action controller
        let params: any = {
            announce: true
        };

        params[this.type] = this.operation;

        const result = await ApiService.fetch("/", params);

        if(result.hasOwnProperty('announcement')) {
            let announcement = result.announcement;

            if(announcement.hasOwnProperty('description')) {
                this.description = announcement.description;
            }

            if(announcement.hasOwnProperty('params')) {
                // retrieve non-default parameters
                this.params = Object.keys(announcement.params).filter( (a:string) => ['entity', 'fields', 'domain', 'lang', 'order', 'sort', 'start', 'limit'].indexOf(a) < 0);
            }

            if(announcement.hasOwnProperty('response')) {
                this.response = announcement.response;
            }

        }

        // 3) retrieve translation related to action, if any
        this.translation = await ApiService.getTranslation(this.entity, this.lang);


    }


}

export default Controller;